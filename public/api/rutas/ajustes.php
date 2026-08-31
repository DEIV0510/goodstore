<?php
declare(strict_types=1);

/**
 * /api/ajustes/... y /api/whatsapp
 *
 * Dos recursos en un mismo archivo porque comparten tabla y forma: los dos
 * guardan bloques de JSON en `opciones`, uno por sección, y los dos se leen
 * enteros de una vez.
 *
 * Dos reglas de fondo que explican casi todas las decisiones de aquí:
 *
 *   · No se inventa nada. Un campo vacío se guarda vacío y significa «el
 *     negocio todavía no lo definió»: la tienda no pinta el icono de una red
 *     social sin enlace ni anuncia una tarifa de envío que nadie confirmó.
 *     Rellenar esos huecos con algo plausible sería publicar información falsa
 *     en nombre del negocio.
 *
 *   · Cada PUT reemplaza una sección entera, pero se construye campo a campo
 *     SOBRE lo que ya estaba guardado. Así un formulario que envíe la mitad de
 *     las claves no borra la otra mitad. Es la misma mezcla por sección que ya
 *     hace la interfaz al leer, solo que aplicada también al escribir.
 *
 * El objeto que manda el navegador nunca se guarda tal cual: se copia campo a
 * campo con los validadores. Si mañana el panel enviara una clave de más, aquí
 * se queda fuera.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// Los nombres de sección y de plantilla salen SIEMPRE de aquí, nunca de la
// entrada del usuario: son las únicas claves que pueden acabar en la base.
// ─────────────────────────────────────────────────────────────────────────────

/** Secciones válidas de /api/ajustes, con la etiqueta que verá el historial. */
const GG_AJUSTES_SECCIONES = [
    'company'  => 'Datos de la empresa',
    'socials'  => 'Redes sociales',
    'shipping' => 'Envíos',
    'seo'      => 'SEO y buscadores',
    'payments' => 'Pagos en línea',
];

/** Plantillas de WhatsApp, en el mismo orden en que las pinta el panel. */
const GG_WHATSAPP_PLANTILLAS = [
    'general',
    'catalog',
    'product',
    'cart',
    'used',
    'consoles',
    'accessories',
    'shipping',
];

/** Una plantilla es un mensaje completo, no una etiqueta: cabe holgado. */
const GG_PLANTILLA_MAX = 2000;

// ─────────────────────────────────────────────────────────────────────────────
// Ayudas locales
//
// Todas envuelven a los validadores de http.php añadiendo lo mismo: si la clave
// no viene en el cuerpo, se conserva lo que ya estaba guardado.
// ─────────────────────────────────────────────────────────────────────────────

/** Bloque guardado de una sección, o null si nunca se guardó. */
function gg_ajustes_guardado(string $grupo, string $clave): ?array
{
    $fila = gg_fila('SELECT valor FROM opciones WHERE grupo = ? AND clave = ?', [$grupo, $clave]);
    if (!$fila) {
        return null;
    }
    $v = gg_json($fila['valor'], []);
    return is_array($v) ? $v : [];
}

/**
 * Texto de un ajuste, usando lo ya guardado como valor por omisión.
 *
 * La diferencia importa: si la clave NO viene, se conserva lo anterior; si
 * viene y está vacía, se guarda vacía, porque el administrador la borró a
 * propósito y esa decisión también hay que respetarla.
 */
function gg_ajustes_texto(array $datos, string $clave, int $maximo, array $previo): string
{
    $anterior = $previo[$clave] ?? '';
    return gg_texto($datos, $clave, $maximo, is_scalar($anterior) ? (string) $anterior : '');
}

/**
 * Ruta interna o URL de una imagen o enlace, que SÍ puede quedar vacía.
 *
 * No se usa gg_enlace() porque ante un campo vacío devuelve su valor por
 * omisión: si el administrador borra el logo, se lo volveríamos a poner solos.
 * Se siguen admitiendo únicamente rutas del sitio y http(s), para que un
 * «javascript:» guardado en el panel no acabe siendo un enlace de la tienda.
 */
function gg_ajustes_url(array $datos, string $clave, array $previo, int $maximo = 400): string
{
    $v = gg_ajustes_texto($datos, $clave, $maximo, $previo);
    if ($v === '') {
        return '';
    }
    if (str_starts_with($v, '/')) {
        // «//otro-dominio.com» empieza por «/», pero NO es una ruta del sitio:
        // el navegador lo resuelve como una dirección externa con el mismo
        // esquema, y «/\otro-dominio.com» se normaliza igual. Sin esta
        // comprobación, el logo y la imagen de compartir de la tienda —que
        // /api/publico sirve a cualquier visitante— podrían quedar apuntando a
        // un servidor ajeno.
        if (str_starts_with($v, '//') || str_starts_with($v, '/\\')) {
            throw new GgError(
                "El enlace de «$clave» apunta a otro dominio. Escribe una ruta del sitio, " .
                'como «/medios/logo.webp», o la dirección completa empezando por «https://».'
            );
        }
        return $v;
    }
    if (preg_match('#^https?://[^\s]+$#i', $v)) {
        return $v;
    }
    throw new GgError("El enlace de «$clave» debe empezar por «/» o por «https://».");
}

/**
 * Enlace de una red social: vacío, o https obligatorio.
 *
 * Vacío es un valor legítimo y frecuente: significa «esta red todavía no
 * existe», y la tienda simplemente no dibuja el icono. Nunca se inventa una
 * cuenta. Cuando sí hay enlace se exige https porque es un enlace público y
 * permanente del pie de página; http lo marcaría el navegador como no seguro.
 */
function gg_ajustes_red(array $datos, string $clave, array $previo): string
{
    $v = gg_ajustes_texto($datos, $clave, 300, $previo);
    if ($v === '') {
        return '';
    }
    if (!preg_match('#^https://[^\s]+$#i', $v)) {
        throw new GgError(
            "El enlace de «$clave» debe empezar por «https://», o quedar vacío si esa red todavía no existe."
        );
    }
    return $v;
}

/**
 * Interruptor de un ajuste, conservando el guardado si la clave no viene.
 *
 * Los valores llegan de SQLite pasando por JSON, así que un «sí» puede venir
 * como true, como 1 o como "1" según por dónde haya pasado. gg_bool() los
 * normaliza todos.
 */
function gg_ajustes_interruptor(array $datos, string $clave, array $previo, bool $porOmision): bool
{
    if (!array_key_exists($clave, $datos)) {
        return array_key_exists($clave, $previo) ? gg_bool($previo[$clave]) : $porOmision;
    }
    return gg_bool_entrada($datos, $clave, $porOmision);
}

/**
 * Enlace de cobro de la pasarela.
 *
 * Se exige **https** sin excepción: por aquí pasa dinero de un cliente, y un
 * enlace http lo marcaría el navegador como no seguro justo en el momento de
 * pagar. Vacío es válido y significa «todavía no hay pasarela»: la tienda
 * entonces no enseña el botón, en vez de llevar a una página rota.
 *
 * Que sea un enlace de una pasarela concreta no se puede comprobar aquí sin
 * dejar fuera al proveedor que el negocio elija mañana; el panel enseña el
 * dominio detectado para que quien lo guarda vea a dónde apunta de verdad.
 */
function gg_ajustes_enlace_pago(array $datos, string $clave, array $previo): string
{
    $v = gg_ajustes_texto($datos, $clave, 500, $previo);
    if ($v === '') {
        return '';
    }
    if (!preg_match('#^https://[^\s/]+\.[^\s/]+(/[^\s]*)?$#i', $v)) {
        throw new GgError(
            'El enlace de pago debe ser una dirección completa que empiece por «https://», ' .
            'como la que entrega la pasarela. Déjalo vacío para no ofrecer pago en línea.'
        );
    }
    return $v;
}

/**
 * Importe opcional. null significa «sin definir», que no es cero: cero sería
 * anunciar envío gratis desde el primer peso.
 */
function gg_ajustes_entero(array $datos, string $clave, array $previo, int $maximo): ?int
{
    if (!array_key_exists($clave, $datos)) {
        $anterior = $previo[$clave] ?? null;
        return is_numeric($anterior) ? (int) $anterior : null;
    }
    return gg_entero($datos, $clave, 0, $maximo);
}

/** Lista de textos cortos, conservando la guardada si la clave no viene. */
function gg_ajustes_lista(array $datos, string $clave, array $previo, int $maximo = 30, int $largoItem = 80): array
{
    // Si la clave SÍ viene en la petición, la valida gg_lista y punto: un
    // «coverage» que llegue como texto es un error del que hay que avisar. Si
    // aquí se devolviera una lista vacía, esa petición mal formada borraría en
    // silencio las ciudades de cobertura que el negocio ya tenía guardadas.
    if (array_key_exists($clave, $datos)) {
        return gg_lista($datos, $clave, $maximo, $largoItem);
    }
    // Con lo YA guardado sí se es tolerante: un valor que no sea lista (base
    // tocada a mano, versión vieja) no debe tumbar una petición legítima que ni
    // siquiera toca este campo. Se trata como si no hubiera nada.
    if (!is_array($previo[$clave] ?? null)) {
        return [];
    }
    return gg_lista($previo, $clave, $maximo, $largoItem);
}

/** Correo de contacto del negocio. Vacío es válido: aquí se atiende por WhatsApp. */
function gg_ajustes_correo(array $datos, string $clave, array $previo): string
{
    // No se usa gg_email() porque ese exige que venga y no esté vacío.
    $v = mb_strtolower(gg_ajustes_texto($datos, $clave, 190, $previo));
    if ($v === '') {
        return '';
    }
    if (!filter_var($v, FILTER_VALIDATE_EMAIL)) {
        throw new GgError('El correo de contacto no tiene un formato válido.');
    }
    return $v;
}

/** Código de moneda ISO (COP, USD…). Vacío deja a la tienda con su formato por omisión. */
function gg_ajustes_moneda(array $datos, string $clave, array $previo): string
{
    $v = strtoupper(gg_ajustes_texto($datos, $clave, 10, $previo));
    if ($v === '') {
        return '';
    }
    if (!preg_match('/^[A-Z]{3}$/', $v)) {
        throw new GgError('La moneda debe ser un código de tres letras, como COP.');
    }
    return $v;
}

/**
 * Número de WhatsApp, reducido a dígitos.
 *
 * Se aceptan espacios, guiones y «+» en la entrada porque así es como la gente
 * copia un teléfono, pero lo que se guarda son solo los dígitos: el enlace
 * wa.me no admite otra cosa y un espacio invisible rompería todos los botones
 * de la tienda a la vez.
 */
function gg_ajustes_numero(string $entrada): string
{
    $digitos = preg_replace('/\D+/', '', $entrada) ?? '';

    $valido = strlen($digitos) === 10
        || (strlen($digitos) === 12 && str_starts_with($digitos, '57'));

    if (!$valido) {
        throw new GgError(
            'El número de WhatsApp debe tener 10 dígitos (por ejemplo 3508271637) ' .
            'o 12 empezando por el indicativo 57 (573508271637).'
        );
    }
    return $digitos;
}

/**
 * Aplana un bloque para poder compararlo en el historial.
 *
 * gg_diferencia() compara convirtiendo a texto, y convertir un array a texto en
 * PHP 8 es un aviso y la palabra «Array»: las listas se pasan a JSON antes.
 */
function gg_ajustes_plano(array $valor): array
{
    $plano = [];
    foreach ($valor as $clave => $v) {
        $plano[$clave] = (is_scalar($v) || $v === null)
            ? $v
            : (json_encode($v, JSON_UNESCAPED_UNICODE) ?: '');
    }
    return $plano;
}

/** Recorte para el historial: interesa QUÉ cambió, no releer el mensaje entero. */
function gg_ajustes_recorte(string $texto, int $maximo = 120): string
{
    return mb_strlen($texto) > $maximo ? mb_substr($texto, 0, $maximo) . '…' : $texto;
}

/**
 * Deja constancia del guardado de una sección.
 *
 * La primera vez se registra como creación: gg_auditar_cambio() solo compara
 * claves que ya existían antes, así que sin esto el estreno de una sección no
 * dejaría rastro ninguno.
 */
function gg_ajustes_auditar(string $entidad, string $clave, string $etiqueta, ?array $previo, array $nuevo): void
{
    $despues = gg_ajustes_plano($nuevo);

    if ($previo === null) {
        gg_auditar('crear', $entidad, $clave, $etiqueta, $despues);
        return;
    }

    $antes = gg_ajustes_plano($previo);
    // Un campo que antes no existía cuenta como cambio de null a su valor; si
    // no se rellena, la comparación lo saltaría por no estar en «antes».
    foreach ($despues as $k => $_) {
        if (!array_key_exists($k, $antes)) {
            $antes[$k] = null;
        }
    }

    gg_auditar_cambio($entidad, $clave, $etiqueta, $antes, $despues);
}

// ─────────────────────────────────────────────────────────────────────────────
// Rutas
// ─────────────────────────────────────────────────────────────────────────────

$metodo = gg_metodo();
$accion = $ruta[1] ?? '';
$cuerpo = in_array($metodo, ['POST', 'PATCH', 'PUT'], true) ? gg_cuerpo() : [];

// ═════════════════════════════════════════════════════════════════════════════
// /api/ajustes — empresa, redes, envíos y SEO
// ═════════════════════════════════════════════════════════════════════════════
if ($recurso === 'ajustes') {

    // ── GET /api/ajustes ─────────────────────────────────────────────────────
    //
    // Basta con tener sesión: el nombre de la tienda, la moneda y las etiquetas
    // de envío se usan en casi todas las pantallas del panel, también en las de
    // un editor. Sin sesión no, porque aquí va el correo de contacto.
    if ($accion === '' && $metodo === 'GET') {
        gg_exigir_sesion();
        // Las secciones que nadie ha guardado no aparecen: la interfaz las
        // completa con sus valores por omisión. No se devuelven inventadas.
        gg_responder(['ajustes' => gg_opciones('ajustes')]);
    }

    // ── PUT /api/ajustes/{clave} ─────────────────────────────────────────────
    if ($metodo === 'PUT') {
        // Solo el super administrador: esto cambia lo que la tienda dice de sí
        // misma en todas sus páginas a la vez.
        gg_exigir_rol('super_admin');

        $clave = $accion;
        if (!array_key_exists($clave, GG_AJUSTES_SECCIONES)) {
            throw new GgError(
                'Esa sección de ajustes no existe. Solo se pueden guardar: ' .
                implode(', ', array_keys(GG_AJUSTES_SECCIONES)) . '.',
                400
            );
        }

        $crudo = $cuerpo['valor'] ?? null;
        if (!is_array($crudo)) {
            throw new GgError('El cuerpo debe traer «valor» con los campos de la sección.');
        }

        $previo = gg_ajustes_guardado('ajustes', $clave);
        $base = $previo ?? [];

        // Campo a campo. Lo que no esté en esta lista no llega a la base, venga
        // como venga en el cuerpo de la petición.
        $valor = match ($clave) {
            'company' => [
                'name'          => gg_ajustes_texto($crudo, 'name', 120, $base),
                'tagline'       => gg_ajustes_texto($crudo, 'tagline', 200, $base),
                'claim'         => gg_ajustes_texto($crudo, 'claim', 200, $base),
                'logoUrl'       => gg_ajustes_url($crudo, 'logoUrl', $base),
                'description'   => gg_ajustes_texto($crudo, 'description', 600, $base),
                'city'          => gg_ajustes_texto($crudo, 'city', 80, $base),
                'region'        => gg_ajustes_texto($crudo, 'region', 80, $base),
                'country'       => gg_ajustes_texto($crudo, 'country', 80, $base),
                'locationLabel' => gg_ajustes_texto($crudo, 'locationLabel', 160, $base),
                'shippingLabel' => gg_ajustes_texto($crudo, 'shippingLabel', 160, $base),
                'email'         => gg_ajustes_correo($crudo, 'email', $base),
                'currency'      => gg_ajustes_moneda($crudo, 'currency', $base),
            ],
            'socials' => [
                'instagram' => gg_ajustes_red($crudo, 'instagram', $base),
                'facebook'  => gg_ajustes_red($crudo, 'facebook', $base),
                'tiktok'    => gg_ajustes_red($crudo, 'tiktok', $base),
                'youtube'   => gg_ajustes_red($crudo, 'youtube', $base),
            ],
            'shipping' => [
                'coverage' => gg_ajustes_lista($crudo, 'coverage', $base),
                // null = sin definir. La tienda no muestra una tarifa que el
                // negocio no ha confirmado; dice que se cuadra por WhatsApp.
                'freeFrom' => gg_ajustes_entero($crudo, 'freeFrom', $base, 1000000000),
                'flatRate' => gg_ajustes_entero($crudo, 'flatRate', $base, 1000000000),
                'carrier'  => gg_ajustes_texto($crudo, 'carrier', 120, $base),
                'notes'    => gg_ajustes_texto($crudo, 'notes', 600, $base),
            ],
            'seo' => [
                'title'       => gg_ajustes_texto($crudo, 'title', 200, $base),
                'description' => gg_ajustes_texto($crudo, 'description', 400, $base),
                'keywords'    => gg_ajustes_texto($crudo, 'keywords', 400, $base),
                'ogImage'     => gg_ajustes_url($crudo, 'ogImage', $base),
            ],
            // El enlace de cobro es de monto abierto: el cliente escribe el
            // total en la pasarela. La tienda se lo copia al portapapeles, y
            // solo ofrece pagar cuando el total está cerrado.
            'payments' => [
                'enabled'  => gg_ajustes_interruptor($crudo, 'enabled', $base, false),
                'provider' => gg_ajustes_texto($crudo, 'provider', 60, $base),
                'link'     => gg_ajustes_enlace_pago($crudo, 'link', $base),
                'note'     => gg_ajustes_texto($crudo, 'note', 300, $base),
            ],
        };

        gg_guardar_opcion('ajustes', $clave, $valor);
        gg_ajustes_auditar('ajustes', $clave, GG_AJUSTES_SECCIONES[$clave], $previo, $valor);

        // Se devuelve el grupo entero, con la misma forma que el GET: el panel
        // se queda con el estado real del servidor, no con lo que él creía.
        gg_responder(['ajustes' => gg_opciones('ajustes')]);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// /api/whatsapp — número y plantillas de mensaje
// ═════════════════════════════════════════════════════════════════════════════
if ($recurso === 'whatsapp') {

    // ── GET /api/whatsapp ────────────────────────────────────────────────────
    if ($accion === '' && $metodo === 'GET') {
        gg_exigir_sesion();
        gg_responder(['whatsapp' => gg_opciones('whatsapp')]);
    }

    // ── PUT /api/whatsapp ────────────────────────────────────────────────────
    if ($accion === '' && $metodo === 'PUT') {
        // Admin, no editor: el número de WhatsApp es por donde entra TODA la
        // venta. Cambiarlo por error deja la tienda muda.
        gg_exigir_rol('admin');

        $previo = gg_opciones('whatsapp');
        $numeroPrevio = is_string($previo['number'] ?? null) ? $previo['number'] : '';
        $previas = is_array($previo['templates'] ?? null) ? $previo['templates'] : [];

        $numero = gg_ajustes_numero(gg_texto($cuerpo, 'number', 40, $numeroPrevio));

        $entrada = $cuerpo['templates'] ?? null;
        if ($entrada !== null && !is_array($entrada)) {
            throw new GgError('El campo «templates» debe traer las plantillas de mensaje.');
        }
        $entrada = is_array($entrada) ? $entrada : [];

        // Solo las ocho plantillas conocidas, en su orden. Una clave inventada
        // en el cuerpo no crea una plantilla nueva.
        $plantillas = [];
        foreach (GG_WHATSAPP_PLANTILLAS as $nombre) {
            $plantillas[$nombre] = gg_ajustes_texto($entrada, $nombre, GG_PLANTILLA_MAX, $previas);
        }

        // Dos claves separadas y no un solo bloque: la tienda pública lee el
        // número en cada botón y no necesita arrastrar 16 KB de plantillas.
        //
        // Pero se escriben las dos juntas o no se escribe ninguna: si la
        // segunda fallara, la tienda quedaría escribiendo al número nuevo con
        // los mensajes viejos (o al revés), y nadie sabría que quedó a medias.
        $db = gg_db();
        $db->beginTransaction();
        try {
            gg_guardar_opcion('whatsapp', 'number', $numero);
            gg_guardar_opcion('whatsapp', 'templates', $plantillas);
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }

        // Historial. Se anota qué plantilla cambió y un recorte del texto: ocho
        // mensajes completos por guardado llenarían la tabla de ruido y
        // esconderían justo lo que se busca al revisarla.
        $detalle = [];
        if ($numero !== $numeroPrevio) {
            $detalle['number'] = ['antes' => $numeroPrevio, 'ahora' => $numero];
        }
        foreach ($plantillas as $nombre => $texto) {
            $antes = is_scalar($previas[$nombre] ?? null) ? (string) $previas[$nombre] : '';
            if ($antes !== $texto) {
                $detalle['templates.' . $nombre] = [
                    'antes' => gg_ajustes_recorte($antes),
                    'ahora' => gg_ajustes_recorte($texto),
                ];
            }
        }
        if ($detalle) {
            gg_auditar(
                $previo === [] ? 'crear' : 'actualizar',
                'whatsapp',
                'whatsapp',
                'Mensajes de WhatsApp',
                $detalle
            );
        }

        gg_responder(['whatsapp' => gg_opciones('whatsapp')]);
    }
}

gg_error('No existe esa dirección en la API.', 404);
