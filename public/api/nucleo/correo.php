<?php
declare(strict_types=1);

/**
 * GOOD GAME · Avisos por correo
 *
 * Dos correos, y ninguno es imprescindible para que la venta ocurra:
 *
 *   · al negocio  — «tienes un pedido nuevo», con qué, de quién y a dónde;
 *   · al cliente  — su comprobante, para que no tenga que pedirlo.
 *
 * ── Regla de oro de este archivo ─────────────────────────────────────────────
 *
 * NADA de aquí puede tumbar un pedido. Si el hosting no puede enviar correo, si
 * la dirección está mal escrita o si el servidor de salida tarda, el pedido ya
 * está guardado y el pago ya está hecho: lo único que se pierde es el aviso, y
 * eso se anota en el log. Por eso todas las funciones devuelven bool y ninguna
 * lanza excepciones.
 *
 * Se usa mail() de PHP, que en Hostinger sale por sus propios servidores. Por
 * eso el remitente va SIEMPRE en el dominio del sitio: un From de gmail.com
 * enviado desde el servidor de Hostinger no pasa el SPF y acaba en spam.
 */

/**
 * Remitente. Se calcula del dominio real para que el SPF cuadre: un correo que
 * dice venir de gmail.com pero sale del servidor de Hostinger acaba en spam.
 *
 * Tiene que ser un dominio de verdad. «localhost» y «127.0.0.1» son direcciones
 * válidas para un navegador pero ningún servidor de correo acepta un remitente
 * así, y en desarrollo es justo lo que hay: por eso se cae al dominio del sitio.
 */
function gg_correo_remitente(): string
{
    $host = strtolower((string) (parse_url(gg_url_sitio(), PHP_URL_HOST) ?: ''));

    // Un dominio de correo termina en letras: «.shop», «.com». Una IP no.
    $esDominio = (bool) preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/', $host)
        && !filter_var($host, FILTER_VALIDATE_IP);

    return 'no-responder@' . ($esDominio ? $host : 'goodgamecol.shop');
}

/**
 * Si al cliente se le avisa cuando no se ha guardado nunca la sección de
 * ajustes. Tiene que valer lo mismo que `emailCustomer` en
 * src/services/ajustes.ts y que el tercer argumento del interruptor en
 * rutas/ajustes.php: si se separan, la pantalla enseña el interruptor
 * encendido y el servidor no manda nada. Lo vigila tools/prueba-omisiones.mjs.
 */
const GG_AVISAR_CLIENTE_OMISION = true;

/** Escapa para HTML. Todo lo que viene del cliente pasa por aquí. */
function gg_e(?string $t): string
{
    return htmlspecialchars((string) $t, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Pesos colombianos, como los escribe el país: $165.000 */
function gg_pesos(int $v): string
{
    return '$' . number_format($v, 0, ',', '.');
}

/**
 * Envía un correo. Devuelve si el servidor lo aceptó (que no es lo mismo que
 * que haya llegado: eso no hay forma de saberlo desde aquí).
 *
 * Se manda en multipart/alternative —texto y HTML— porque un correo solo-HTML
 * puntúa peor en los filtros de spam, y porque hay quien lee en texto plano.
 */
function gg_correo_enviar(
    string $para,
    string $asunto,
    string $html,
    string $texto,
    string $responderA = ''
): bool {
    if (!filter_var($para, FILTER_VALIDATE_EMAIL)) {
        error_log('[GOOD GAME] Dirección de aviso inválida: ' . $para);
        return false;
    }

    $de = gg_correo_remitente();
    $asuntoCodificado = gg_correo_mime($asunto);
    $limite = 'gg-' . bin2hex(random_bytes(12));

    $cabeceras = [
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $limite . '"',
        // El nombre va codificado: sin esto, «GOOD GAME · Pedidos» llega roto.
        'From: ' . gg_correo_mime('GOOD GAME') . ' <' . $de . '>',
        'X-Mailer: GOOD GAME',
        // Un aviso de pedido no es una newsletter, pero algunos filtros premian
        // que el remitente diga que no espera respuesta automática.
        'Auto-Submitted: auto-generated',
    ];
    if ($responderA !== '' && filter_var($responderA, FILTER_VALIDATE_EMAIL)) {
        $cabeceras[] = 'Reply-To: ' . $responderA;
    }

    $cuerpo = "--$limite\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: 8bit\r\n\r\n"
        . $texto . "\r\n\r\n"
        . "--$limite\r\n"
        . "Content-Type: text/html; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: 8bit\r\n\r\n"
        . $html . "\r\n\r\n"
        . "--$limite--";

    // ── Primero, por SMTP autenticado si lo hay ──────────────────────────
    //
    // Es el único camino por el que el correo llega a la bandeja de entrada:
    // el sobre lleva el dominio propio y el servidor lo firma con DKIM, así
    // que DMARC alinea. Ver la explicación larga en nucleo/smtp.php.
    if (function_exists('gg_smtp_config') && gg_smtp_config()['activo']) {
        $ok = gg_smtp_enviar($de, $para, $asuntoCodificado, $cabeceras, $cuerpo);
        if ($ok) {
            return true;
        }
        // Si el SMTP falla no se da por perdido el aviso: se intenta por
        // mail(), que llega peor pero llega.
        error_log('[GOOD GAME] SMTP falló; reintentando con mail().');
    }

    if (!function_exists('mail')) {
        error_log('[GOOD GAME] El hosting no tiene mail() disponible.');
        return false;
    }

    // El quinto parámetro fija el remitente del sobre. Algunos hostings lo
    // prohíben y mail() falla entero, así que si no cuela se reintenta sin él.
    $ok = @mail($para, $asuntoCodificado, $cuerpo, implode("\r\n", $cabeceras), '-f' . $de);
    if (!$ok) {
        $ok = @mail($para, $asuntoCodificado, $cuerpo, implode("\r\n", $cabeceras));
    }
    if (!$ok) {
        error_log('[GOOD GAME] No se pudo enviar el aviso a ' . $para);
    }
    return $ok;
}

/** Codifica un texto con tildes para una cabecera de correo (RFC 2047). */
function gg_correo_mime(string $t): string
{
    return preg_match('/[\x80-\xFF]/', $t) ? '=?UTF-8?B?' . base64_encode($t) . '?=' : $t;
}

// ─────────────────────────────────────────────────────────────────────────────
// La plantilla
//
// HTML de correo, que no es HTML de web: tablas, estilos en línea y nada de
// hojas de estilo externas. Gmail y Outlook descartan casi todo lo demás.
// ─────────────────────────────────────────────────────────────────────────────

function gg_correo_plantilla(string $titulo, string $intro, string $contenido, string $piePropio = ''): string
{
    $t = gg_e($titulo);
    $i = gg_e($intro);
    $sitio = gg_url_sitio();

    return <<<HTML
<!doctype html>
<html lang="es"><body style="margin:0;padding:24px 12px;background:#f4f5fb;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e4e6f0;">
  <tr><td style="background:#070A78;padding:20px 24px;">
    <p style="margin:0;color:#FFF000;font-size:19px;font-weight:800;letter-spacing:.5px;">GOOD GAME</p>
    <p style="margin:2px 0 0;color:#ffffff;opacity:.72;font-size:12px;">Videojuegos · Consolas · Accesorios</p>
  </td></tr>
  <tr><td style="padding:24px;">
    <h1 style="margin:0 0 6px;font-size:19px;color:#12143a;">$t</h1>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#565a7a;">$i</p>
    $contenido
  </td></tr>
  <tr><td style="padding:16px 24px 22px;border-top:1px solid #eceef6;">
    $piePropio
    <p style="margin:10px 0 0;font-size:11.5px;line-height:1.6;color:#9296b4;">
      Este correo lo envió sola la tienda <a href="$sitio" style="color:#3641DC;">$sitio</a>.
      Itagüí, Antioquia, Colombia.
    </p>
  </td></tr>
</table>
</body></html>
HTML;
}

/** Las líneas del pedido, como tabla de correo. */
function gg_correo_lineas(array $lineas, int $total): string
{
    $filas = '';
    foreach ($lineas as $l) {
        $filas .= '<tr>'
            . '<td style="padding:8px 0;border-bottom:1px solid #f0f1f7;font-size:13.5px;color:#12143a;">'
            . gg_e((string) $l['nombre'])
            . '<span style="color:#9296b4;"> · ' . gg_e((string) ($l['plataforma'] ?? '')) . '</span>'
            . ($l['cantidad'] > 1 ? ' <strong>×' . (int) $l['cantidad'] . '</strong>' : '')
            . '</td>'
            . '<td align="right" style="padding:8px 0;border-bottom:1px solid #f0f1f7;font-size:13.5px;color:#12143a;white-space:nowrap;">'
            . gg_pesos(((int) $l['precio_unit']) * ((int) $l['cantidad']))
            . '</td></tr>';
    }

    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
        . $filas
        . '<tr><td style="padding:12px 0 0;font-size:15px;font-weight:800;color:#12143a;">TOTAL</td>'
        . '<td align="right" style="padding:12px 0 0;font-size:17px;font-weight:800;color:#070A78;white-space:nowrap;">'
        . gg_pesos($total) . '</td></tr></table>';
}

/** Ficha de datos: etiqueta y valor, saltando lo que esté vacío. */
function gg_correo_ficha(array $pares): string
{
    $filas = '';
    foreach ($pares as $etiqueta => $valor) {
        if (trim((string) $valor) === '') {
            continue;
        }
        $filas .= '<tr>'
            . '<td style="padding:3px 12px 3px 0;font-size:13px;color:#9296b4;white-space:nowrap;vertical-align:top;">'
            . gg_e($etiqueta) . '</td>'
            . '<td style="padding:3px 0;font-size:13.5px;color:#12143a;">' . gg_e((string) $valor) . '</td>'
            . '</tr>';
    }
    return $filas === ''
        ? ''
        : '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">' . $filas . '</table>';
}

// ─────────────────────────────────────────────────────────────────────────────
// Los dos avisos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Al negocio: un pedido nuevo, o el mismo pedido ya pagado.
 *
 * `$evento` es 'nuevo' o 'pagado'. Se manda a la dirección de Ajustes → Pagos;
 * si está vacía no se envía nada y no es un error: significa que el negocio
 * todavía no dijo a dónde quiere los avisos.
 */
function gg_correo_al_negocio(array $pedido, array $lineas, ?array $cliente, string $evento): bool
{
    $para = trim((string) (gg_opciones('ajustes')['payments']['orderEmail'] ?? ''));
    if ($para === '') {
        return false;
    }

    $codigo = (string) $pedido['codigo'];
    $total = (int) $pedido['total'];
    $pagado = $evento === 'pagado';

    $asunto = ($pagado ? 'Pago aprobado · ' : 'Pedido nuevo · ') . $codigo . ' · ' . gg_pesos($total);

    $ficha = gg_correo_ficha([
        'Cliente'  => $cliente['nombre'] ?? '',
        'WhatsApp' => $cliente['whatsapp'] ?? '',
        'Correo'   => $cliente['email'] ?? '',
        'Ciudad'   => $cliente['ciudad'] ?? '',
        'Envío'    => $pedido['direccion'] ?? '',
        'Pago'     => $pagado
            ? 'APROBADO · ' . ($pedido['pago'] ?? '')
            : 'Pendiente · ' . ($pedido['pago'] ?? ''),
    ]);

    $wa = ($cliente['whatsapp'] ?? '') !== ''
        ? '<a href="https://wa.me/57' . gg_e(preg_replace('/\D/', '', (string) $cliente['whatsapp']) ?? '')
          . '" style="display:inline-block;padding:10px 18px;background:#25D366;color:#04241a;'
          . 'text-decoration:none;border-radius:9px;font-size:13.5px;font-weight:700;">Escribirle por WhatsApp</a> '
        : '';

    $html = gg_correo_plantilla(
        $pagado ? "Pago aprobado · $codigo" : "Pedido nuevo · $codigo",
        $pagado
            ? 'El cliente ya pagó. Solo queda preparar el envío.'
            : 'Entró un pedido desde la tienda. Todavía no está pagado.',
        $ficha . gg_correo_lineas($lineas, $total),
        $wa . '<a href="' . gg_url_sitio() . '/admin/pedidos" style="display:inline-block;padding:10px 18px;'
            . 'background:#070A78;color:#ffffff;text-decoration:none;border-radius:9px;font-size:13.5px;'
            . 'font-weight:700;">Ver en el panel</a>'
    );

    $texto = ($pagado ? "PAGO APROBADO · $codigo\n" : "PEDIDO NUEVO · $codigo\n")
        . str_repeat('-', 40) . "\n"
        . 'Cliente:  ' . ($cliente['nombre'] ?? '(sin nombre)') . "\n"
        . 'WhatsApp: ' . ($cliente['whatsapp'] ?? '-') . "\n"
        . 'Envío:    ' . ($pedido['direccion'] ?? '-') . "\n\n";
    foreach ($lineas as $l) {
        $texto .= sprintf(
            "%d× %s — %s\n",
            (int) $l['cantidad'],
            (string) $l['nombre'],
            gg_pesos(((int) $l['precio_unit']) * ((int) $l['cantidad']))
        );
    }
    $texto .= "\nTOTAL: " . gg_pesos($total) . "\n\n" . gg_url_sitio() . "/admin/pedidos\n";

    // Responder al correo lleva directo al cliente, si lo dejó.
    return gg_correo_enviar($para, $asunto, $html, $texto, (string) ($cliente['email'] ?? ''));
}

/** Al cliente: su comprobante. Solo si dejó correo y el negocio lo tiene activado. */
function gg_correo_al_cliente(array $pedido, array $lineas, ?array $cliente, string $evento): bool
{
    $ajustes = gg_opciones('ajustes')['payments'] ?? [];
    if (!gg_bool($ajustes['emailCustomer'] ?? GG_AVISAR_CLIENTE_OMISION)) {
        return false;
    }
    $para = trim((string) ($cliente['email'] ?? ''));
    if ($para === '') {
        return false;
    }

    $codigo = (string) $pedido['codigo'];
    $total = (int) $pedido['total'];
    $pagado = $evento === 'pagado';

    $html = gg_correo_plantilla(
        $pagado ? '¡Gracias por tu compra!' : 'Recibimos tu pedido',
        $pagado
            ? "Tu pago quedó aprobado. Tu pedido es el $codigo y ya lo estamos preparando; "
              . 'te escribimos por WhatsApp para cuadrar el envío.'
            : "Tu pedido es el $codigo. En cuanto confirmemos el pago te avisamos por WhatsApp.",
        gg_correo_ficha([
            'Pedido' => $codigo,
            'Envío'  => $pedido['direccion'] ?? '',
        ]) . gg_correo_lineas($lineas, $total),
        '<p style="margin:0;font-size:13px;color:#565a7a;">¿Alguna duda? Escríbenos por WhatsApp al '
            . gg_e(gg_correo_whatsapp_visible()) . '.</p>'
    );

    $texto = ($pagado ? "¡Gracias por tu compra!\n\n" : "Recibimos tu pedido.\n\n")
        . "Pedido: $codigo\n" . str_repeat('-', 40) . "\n";
    foreach ($lineas as $l) {
        $texto .= sprintf(
            "%d× %s — %s\n",
            (int) $l['cantidad'],
            (string) $l['nombre'],
            gg_pesos(((int) $l['precio_unit']) * ((int) $l['cantidad']))
        );
    }
    $texto .= "\nTOTAL: " . gg_pesos($total) . "\n\nGOOD GAME · " . gg_url_sitio() . "\n";

    return gg_correo_enviar($para, "Tu pedido $codigo · GOOD GAME", $html, $texto);
}

/** El WhatsApp del negocio tal como se escribe, para los correos. */
function gg_correo_whatsapp_visible(): string
{
    $n = preg_replace('/\D/', '', (string) (gg_opciones('whatsapp')['number'] ?? '')) ?? '';
    if (strlen($n) !== 10) {
        $n = '3508271637';
    }
    return substr($n, 0, 3) . ' ' . substr($n, 3, 3) . ' ' . substr($n, 6);
}
