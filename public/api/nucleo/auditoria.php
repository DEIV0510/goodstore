<?php
declare(strict_types=1);

/**
 * GOOD GAME · Historial de cambios
 *
 * Deja constancia de quién cambió qué y cuándo. En las ediciones guarda SOLO
 * los campos que cambiaron, con su valor anterior y el nuevo: un registro que
 * diga "se actualizó el producto" sin decir qué cambió no sirve de nada cuando
 * hay que revisar un precio raro tres semanas después.
 *
 * La API no expone ninguna forma de escribir aquí: solo se llama desde el
 * propio backend, al terminar una operación que sí salió bien.
 */

function gg_auditar(
    string $accion,
    string $entidad,
    ?string $entidadId,
    string $etiqueta,
    array $detalle = [],
    ?array $actor = null
): void {
    $u = $actor ?? gg_usuario();

    try {
        gg_insertar('auditoria', [
            'id'         => null,
            'actor_id'   => $u['id'] ?? null,
            'actor'      => trim((string) ($u['nombre'] ?? '')) ?: (string) ($u['email'] ?? 'sistema'),
            'accion'     => $accion,
            'entidad'    => $entidad,
            'entidad_id' => $entidadId,
            'etiqueta'   => mb_substr($etiqueta, 0, 160),
            'detalle'    => json_encode($detalle, JSON_UNESCAPED_UNICODE) ?: '{}',
            'creado'     => gg_ahora(),
        ]);
    } catch (Throwable) {
        // Que falle el historial no puede tumbar la operación que el
        // administrador acaba de hacer con éxito.
    }
}

/**
 * Diferencia entre el estado anterior y el nuevo, en las claves indicadas.
 *
 * Se ignoran las columnas que cambian solas (marcas de tiempo, contadores de
 * vistas): registrarlas llenaría el historial de ruido y escondería justo los
 * cambios que importan.
 */
function gg_diferencia(array $antes, array $despues, array $ignorar = []): array
{
    $ignorar = array_merge(['actualizado', 'creado', 'vistas', 'ultimo_acceso'], $ignorar);
    $salida = [];

    foreach ($despues as $clave => $nuevo) {
        if (in_array($clave, $ignorar, true) || !array_key_exists($clave, $antes)) {
            continue;
        }
        $viejo = $antes[$clave];

        // Comparación laxa a propósito: SQLite devuelve 1 donde PHP tiene true,
        // y "45000" donde tiene 45000. Sin esto, cada guardado registraría
        // cambios que en realidad no existen.
        if ((string) $viejo === (string) $nuevo) {
            continue;
        }
        $salida[$clave] = ['antes' => $viejo, 'ahora' => $nuevo];
    }
    return $salida;
}

/** Registra una edición solo si de verdad cambió algo. */
function gg_auditar_cambio(
    string $entidad,
    string $id,
    string $etiqueta,
    array $antes,
    array $despues,
    array $ignorar = []
): void {
    $dif = gg_diferencia($antes, $despues, $ignorar);
    if (!$dif) {
        return;
    }
    gg_auditar('actualizar', $entidad, $id, $etiqueta, $dif);
}
