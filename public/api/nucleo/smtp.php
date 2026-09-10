<?php
declare(strict_types=1);

/**
 * GOOD GAME · Enviar correo por SMTP autenticado
 *
 * ── Por qué existe este archivo ──────────────────────────────────────────────
 *
 * Con la función mail() de PHP, Hostinger saca el correo por su propio relé y
 * le pone el remitente del sobre (el Return-Path) en un dominio suyo:
 * «srv366.main-hosting.eu». El resultado, comprobado leyendo la cabecera real
 * de un correo entregado el 2026-09-10:
 *
 *     SPF:   PASS con la IP 23.83.222.34
 *     DMARC: FAIL
 *
 * Las dos cosas a la vez no son una contradicción. SPF pasa —para el dominio de
 * Hostinger—, pero DMARC exige que el dominio que pasa la comprobación sea EL
 * MISMO que aparece en el «De:». Como no lo es, no hay alineación, y el correo
 * cae en spam. Por el camino de mail() no hay forma de arreglarlo: el hosting
 * tampoco firma con DKIM lo que sale por ahí.
 *
 * Enviando por el SMTP autenticado del buzón del dominio, el correo sale por la
 * misma puerta que el correo normal: el sobre lleva el dominio propio y el
 * servidor lo firma con la DKIM que ya publica. Ahí sí alinea, y llega a la
 * bandeja de entrada.
 *
 * ── Por qué está escrito a mano ──────────────────────────────────────────────
 *
 * El proyecto no tiene composer ni dependencias: se publica copiando archivos.
 * Meter una librería entera para hablar un protocolo de diez órdenes sería
 * cambiar cómo se publica el sitio a cambio de nada.
 *
 * Si no hay SMTP configurado, esto no se usa y todo sigue saliendo por mail().
 */

/** Cuánto se espera al servidor de correo antes de rendirse, en segundos. */
const GG_SMTP_ESPERA = 12;

/**
 * La configuración del SMTP, con la clave sacada del grupo de secretos.
 *
 * `activo` es falso mientras falte cualquiera de las cuatro piezas: sin las
 * cuatro no hay envío posible, y es mejor caer a mail() —que al menos llega a
 * spam— que no mandar nada.
 */
function gg_smtp_config(): array
{
    $a = gg_opciones('ajustes')['payments'] ?? [];
    $clave = trim((string) (gg_opciones('secretos')['smtpClave'] ?? ''));

    $host = trim((string) ($a['smtpHost'] ?? ''));
    $usuario = trim((string) ($a['smtpUser'] ?? ''));
    $puerto = (int) ($a['smtpPort'] ?? 465);

    return [
        'activo'  => gg_bool($a['smtpEnabled'] ?? false)
            && $host !== '' && $usuario !== '' && $clave !== '' && $puerto > 0,
        'host'    => $host,
        'puerto'  => $puerto > 0 ? $puerto : 465,
        'usuario' => $usuario,
        'clave'   => $clave,
    ];
}

/**
 * Arma el mensaje completo tal y como viaja por el cable.
 *
 * Está separado del envío a propósito: así se puede comprobar byte a byte sin
 * levantar ningún servidor, que es donde se esconden los fallos de este
 * protocolo (una línea con final equivocado, un punto sin escapar).
 *
 * - Todas las líneas terminan en CRLF. El correo no admite otra cosa.
 * - Un punto al principio de línea se duplica: un punto solo en su línea es la
 *   señal de «aquí acaba el mensaje», así que un texto que empiece por punto
 *   cortaría el correo por la mitad.
 * - Date y Message-ID los pone mail() por su cuenta, pero por SMTP no los pone
 *   nadie, y un mensaje sin ellos puntúa peor en los filtros.
 */
function gg_smtp_mensaje(
    string $de,
    string $para,
    string $asunto,
    array $cabeceras,
    string $cuerpo,
    string $idUnico = ''
): string {
    $dominio = substr($de, (int) strpos($de, '@') + 1);
    $id = $idUnico !== '' ? $idUnico : bin2hex(random_bytes(12));

    $todas = array_merge(
        [
            'Date: ' . date(DATE_RFC2822),
            'Message-ID: <' . $id . '@' . $dominio . '>',
            'To: ' . $para,
            'Subject: ' . $asunto,
        ],
        $cabeceras
    );

    $texto = implode("\r\n", $todas) . "\r\n\r\n" . $cuerpo;

    // Normalizar finales de línea antes de escapar los puntos: si quedara algún
    // \n suelto, el punto de la línea siguiente no se detectaría.
    $texto = str_replace(["\r\n", "\r", "\n"], "\n", $texto);
    $texto = str_replace("\n.", "\n..", $texto);
    if (str_starts_with($texto, '.')) {
        $texto = '.' . $texto;
    }

    return str_replace("\n", "\r\n", $texto);
}

/**
 * Lee la respuesta del servidor, que puede venir en varias líneas.
 *
 * En SMTP las líneas intermedias llevan un guion tras el número («250-AUTH»)
 * y la última un espacio («250 OK»). Devuelve el código y el texto entero.
 */
function gg_smtp_leer($socket): array
{
    $texto = '';
    $codigo = 0;

    while (($linea = fgets($socket, 1024)) !== false) {
        $texto .= $linea;
        if (strlen($linea) >= 4 && $linea[3] === ' ') {
            $codigo = (int) substr($linea, 0, 3);
            break;
        }
        if (strlen($linea) < 4) {
            break;
        }
    }

    return [$codigo, trim($texto)];
}

/**
 * Manda una orden y comprueba que el servidor contesta lo que se espera.
 *
 * Lanza excepción al primer desvío: seguir hablando con un servidor que ya
 * dijo que no acaba en un correo perdido sin que nadie se entere.
 */
function gg_smtp_ordenar($socket, ?string $orden, array $esperados, string $paso): string
{
    if ($orden !== null) {
        fwrite($socket, $orden . "\r\n");
    }
    [$codigo, $texto] = gg_smtp_leer($socket);

    if (!in_array($codigo, $esperados, true)) {
        // La contraseña nunca aparece aquí: si la orden era AUTH, se dice el
        // paso, no lo que se mandó.
        throw new RuntimeException("SMTP falló en «{$paso}»: {$texto}");
    }

    return $texto;
}

/**
 * Envía de verdad. Devuelve si el servidor aceptó el mensaje.
 *
 * Se traga los errores igual que el resto del correo del proyecto: una venta
 * nunca se cae porque el servidor de correo esté de mal humor.
 */
function gg_smtp_enviar(
    string $de,
    string $para,
    string $asunto,
    array $cabeceras,
    string $cuerpo
): bool {
    $cfg = gg_smtp_config();
    if (!$cfg['activo']) {
        return false;
    }

    // 465 habla cifrado desde el saludo; 587 empieza en claro y sube a TLS con
    // STARTTLS. Son las dos formas que ofrece cualquier hosting.
    $directo = $cfg['puerto'] === 465;
    $destino = ($directo ? 'ssl://' : 'tcp://') . $cfg['host'] . ':' . $cfg['puerto'];

    $contexto = stream_context_create([
        'ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'SNI_enabled' => true],
    ]);

    $socket = @stream_socket_client(
        $destino,
        $errNo,
        $errStr,
        GG_SMTP_ESPERA,
        STREAM_CLIENT_CONNECT,
        $contexto
    );

    if (!$socket) {
        error_log("[GOOD GAME] SMTP: no se pudo conectar a $destino ($errStr)");
        return false;
    }

    stream_set_timeout($socket, GG_SMTP_ESPERA);

    try {
        gg_smtp_ordenar($socket, null, [220], 'saludo');

        $yo = substr($de, (int) strpos($de, '@') + 1);
        $bienvenida = gg_smtp_ordenar($socket, 'EHLO ' . $yo, [250], 'EHLO');

        if (!$directo) {
            gg_smtp_ordenar($socket, 'STARTTLS', [220], 'STARTTLS');
            $subido = @stream_socket_enable_crypto(
                $socket,
                true,
                STREAM_CRYPTO_METHOD_TLS_CLIENT
            );
            if ($subido !== true) {
                throw new RuntimeException('SMTP: no se pudo cifrar la conexión con STARTTLS');
            }
            // Tras cifrar hay que volver a presentarse: lo anterior se dijo en
            // claro y el servidor lo descarta.
            $bienvenida = gg_smtp_ordenar($socket, 'EHLO ' . $yo, [250], 'EHLO tras STARTTLS');
        }

        if (stripos($bienvenida, 'AUTH') === false) {
            throw new RuntimeException('SMTP: el servidor no ofrece autenticación');
        }

        gg_smtp_ordenar($socket, 'AUTH LOGIN', [334], 'AUTH LOGIN');
        gg_smtp_ordenar($socket, base64_encode($cfg['usuario']), [334], 'usuario');
        gg_smtp_ordenar($socket, base64_encode($cfg['clave']), [235], 'contraseña');

        gg_smtp_ordenar($socket, 'MAIL FROM:<' . $de . '>', [250], 'MAIL FROM');
        gg_smtp_ordenar($socket, 'RCPT TO:<' . $para . '>', [250, 251], 'RCPT TO');
        gg_smtp_ordenar($socket, 'DATA', [354], 'DATA');

        fwrite($socket, gg_smtp_mensaje($de, $para, $asunto, $cabeceras, $cuerpo) . "\r\n.\r\n");
        gg_smtp_ordenar($socket, null, [250], 'entrega');

        @fwrite($socket, "QUIT\r\n");
        fclose($socket);
        return true;
    } catch (Throwable $e) {
        error_log('[GOOD GAME] ' . $e->getMessage());
        @fclose($socket);
        return false;
    }
}
