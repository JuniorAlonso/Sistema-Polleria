const express = require('express');
const QRCode = require('qrcode');
const config = require('../config');
const { requiereRol, requiereClaveInterna } = require('./auth');
const { ESTADOS_DELIVERY, mensajePago, mensajeEstado, mensajeComprobanteRechazado, mensajeCodigo } = require('../notifications/messages');
const { ESTADOS_LOG } = require('../notifications/store');
const { claveDeUsuario, ESTADO_PEDIDO_CONFIRMADO } = require('../chatbot/chatbot');
const { crearLogger } = require('../logger');
const logger = crearLogger('HttpApp');

const ESTADO_WHATSAPP = {
    CONECTADO: 'connected',
    ESPERANDO_QR: 'waiting_qr',
    INICIANDO: 'starting',
    DESCONECTADO: 'disconnected',
    ERROR_AUTENTICACION: 'auth_failure',
    ERROR_INICIO: 'error_inicio'
};

function esIdValido(valor) {
    return Number.isInteger(Number(valor)) && Number(valor) > 0;
}

function responderEncolado(res, log) {
    const status = log.estado === 'ERROR' ? 422 : 202;
    res.status(status).json({
        status: log.estado,
        notificacionId: log.id,
        mensaje: log.estado === 'ERROR'
            ? `No se pudo encolar: ${log.errorDetalle}`
            : 'Notificación encolada exitosamente'
    });
}

/**
 * @param service   NotificacionService
 * @param store     store del NotificationLog
 * @param estadoWhatsapp función que devuelve el estado de la sesión
 */
const IPS_LOCALES = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

const ORIGEN_LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/**
 * Orígenes del panel: la lista configurada más cualquier puerto de loopback. El panel
 * corre en la misma máquina que este servicio, y `ng serve` cambia de puerto cuando
 * 4200 está ocupado (o el usuario abre la app por 127.0.0.1). Con la lista exacta, el
 * navegador bloqueaba la petición del QR en esos casos. Un origen externo sigue sin
 * habilitarse.
 */
function origenPermitido(origen) {
    if (!origen) return false;
    if (config.corsOrigins.includes(origen)) return true;
    return ORIGEN_LOOPBACK.test(origen);
}

function escaparHtml(texto) {
    return String(texto)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function paginaQr(titulo, cuerpo, recargarSeg) {
    const recarga = recargarSeg ? `<meta http-equiv="refresh" content="${recargarSeg}">` : '';
    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>QR WhatsApp - San Pollo</title>${recarga}
<style>body{font-family:sans-serif;text-align:center;padding:40px;background:#f0f0f0;color:#333}
img{border:8px solid #fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.15)}p{color:#777;font-size:13px}</style>
</head><body><h2>${titulo}</h2>${cuerpo}</body></html>`;
}

/**
 * @param ultimoQr  función que devuelve el último QR de WhatsApp (o null)
 * @param errorWhatsapp función que devuelve el motivo del último fallo de arranque (o null)
 */
function crearApp({ service, store, conversacion, estadoWhatsapp, ultimoQr = () => null, errorWhatsapp = () => null, reiniciarWhatsapp = async () => {} }) {
    const app = express();
    app.use(express.json());

    // CORS para el panel de administración (Angular)
    app.use((req, res, next) => {
        const origen = req.headers.origin;
        if (origenPermitido(origen)) {
            res.setHeader('Access-Control-Allow-Origin', origen);
            res.setHeader('Vary', 'Origin');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Internal-Key');
        }
        if (req.method === 'OPTIONS') return res.sendStatus(204);
        next();
    });

    const router = express.Router();

    // RF30 — Pago de delivery confirmado (llamado por payments-service)
    router.post('/whatsapp/pago', requiereClaveInterna, async (req, res, next) => {
        try {
            const { ordenId, numeroPedido, telefono, nombreCliente, montoTotal, tiempoEstimado } = req.body;

            if (!esIdValido(ordenId) || !telefono || !(Number(montoTotal) > 0)) {
                return res.status(400).json({ error: 'Campos requeridos: ordenId, telefono, montoTotal (> 0)' });
            }

            if (conversacion && telefono) {
                const clave = claveDeUsuario(telefono);
                try {
                    await conversacion.del(clave);
                    logger.info(`Conversación de ${clave} liberada tras confirmación de pago para orden #${ordenId}`);
                } catch (e) {
                    logger.warn(`No se pudo limpiar conversación de ${clave}: ${e.message}`);
                }
            }

            const log = await service.encolar({
                ordenId: Number(ordenId),
                telefono,
                tipo: 'PAGO_CONFIRMADO',
                mensaje: mensajePago({ ordenId, numeroPedido, nombreCliente, montoTotal, tiempoEstimado })
            });
            responderEncolado(res, log);
        } catch (error) {
            next(error);
        }
    });

    // RF31 — Cambio de estado de delivery (llamado por orders-service)
    router.post('/whatsapp/estado', requiereClaveInterna, async (req, res, next) => {
        try {
            const { ordenId, telefono, estadoNuevo } = req.body;

            if (!esIdValido(ordenId) || !telefono || !estadoNuevo) {
                return res.status(400).json({ error: 'Campos requeridos: ordenId, telefono, estadoNuevo' });
            }
            if (!ESTADOS_DELIVERY.includes(estadoNuevo)) {
                return res.status(400).json({
                    error: `estadoNuevo debe ser uno de: ${ESTADOS_DELIVERY.join(', ')}`
                });
            }

            if (conversacion && telefono && (estadoNuevo === 'EN_PREPARACION' || estadoNuevo === 'EN_CAMINO' || estadoNuevo === 'ENTREGADO')) {
                const clave = claveDeUsuario(telefono);
                try {
                    await conversacion.del(clave);
                } catch (e) {}
            }

            const log = await service.encolar({
                ordenId: Number(ordenId),
                telefono,
                tipo: `ESTADO_${estadoNuevo}`,
                mensaje: mensajeEstado(req.body)
            });
            responderEncolado(res, log);
        } catch (error) {
            next(error);
        }
    });

    // T6d (S6/S13) — Aviso al cliente cuando el ADMIN rechaza el comprobante de Yape. El
    // rechazo deja el pedido impago esperando un comprobante válido, así que el cliente tiene
    // que enterarse para poder reenviarlo. Mismo patrón que el resto de los avisos internos:
    // X-Internal-Key, la cola única (T4) y el registro en el historial (RF32).
    router.post('/whatsapp/comprobante-rechazado', requiereClaveInterna, async (req, res, next) => {
        try {
            const { ordenId, numeroPedido, telefono, nombreCliente } = req.body;
            const motivo = String(req.body.motivo || '').trim();

            if (!esIdValido(ordenId) || !telefono || !motivo) {
                return res.status(400).json({ error: 'Campos requeridos: ordenId, telefono, motivo' });
            }

            if (conversacion && telefono) {
                const clave = claveDeUsuario(telefono);
                try {
                    const actual = await conversacion.get(clave);
                    if (actual && actual.pedido) {
                        await conversacion.set(clave, {
                            ...actual,
                            estado: ESTADO_PEDIDO_CONFIRMADO,
                            comprobanteRecibido: false,
                            motivoRechazo: motivo
                        });
                        logger.info(`Conversación de ${clave} reseteada a PEDIDO_CONFIRMADO para reenvío de comprobante (motivo: "${motivo}")`);
                    }
                } catch (e) {}
            }

            const log = await service.encolar({
                ordenId: Number(ordenId),
                telefono,
                tipo: 'COMPROBANTE_RECHAZADO',
                mensaje: mensajeComprobanteRechazado({ ordenId, numeroPedido, nombreCliente, motivo })
            });
            responderEncolado(res, log);
        } catch (error) {
            next(error);
        }
    });

    // Código para ver pedidos sin iniciar sesión (llamado por orders-service)
    router.post('/whatsapp/codigo', requiereClaveInterna, async (req, res, next) => {
        try {
            const { telefono, codigo } = req.body;

            if (!telefono || !/^\d{4,6}$/.test(String(codigo || ''))) {
                return res.status(400).json({ error: 'Campos requeridos: telefono, codigo (4 a 6 dígitos)' });
            }

            const log = await service.encolar({
                ordenId: null,
                telefono,
                tipo: 'CODIGO_SEGUIMIENTO',
                mensaje: mensajeCodigo({ codigo }),
                // En el historial no se guarda el código real
                mensajeRegistro: mensajeCodigo({ codigo: '****' })
            });
            responderEncolado(res, log);
        } catch (error) {
            next(error);
        }
    });

    // T5 (S4/S8/S11) — Configuración administrable desde el panel. Solo ADMIN: es la
    // pantalla del administrador la que edita el anti-baneo y los números de contacto.
    // El store vive en memoria (S8): lo que se cambie aquí se pierde al reiniciar.
    const ajustesDelServicio = () => {
        if (!service || !service.ajustes || typeof service.ajustes.obtener !== 'function') {
            throw new Error('El servicio de notificaciones no expone ajustes en memoria');
        }
        return service.ajustes;
    };

    router.get('/ajustes', requiereRol('ADMIN'), (req, res, next) => {
        try {
            res.json({
                ajustes: ajustesDelServicio().obtener(),
                // Mismo estado que publica /status como `antiBaneo`: pausa, presupuesto
                // consumido, ventana horaria y breaker.
                gobernador: typeof service.estadoAntiBaneo === 'function' ? service.estadoAntiBaneo() : null
            });
        } catch (error) {
            next(error);
        }
    });

    router.patch('/ajustes', requiereRol('ADMIN'), (req, res, next) => {
        try {
            const cambios = req.body;
            if (cambios === null || typeof cambios !== 'object' || Array.isArray(cambios)) {
                return res.status(400).json({ error: 'El cuerpo debe ser un objeto con los ajustes a cambiar' });
            }
            // `actualizar()` valida y lanza RangeError sin aplicar nada: el store queda intacto.
            const ajustes = ajustesDelServicio().actualizar(cambios);
            if (Object.prototype.hasOwnProperty.call(cambios, 'operativoTodoElDia') && service?.cola?.despertar) {
                service.cola.despertar();
            }
            res.json(ajustes);
        } catch (error) {
            if (error instanceof RangeError) {
                return res.status(400).json({ error: error.message });
            }
            next(error);
        }
    });

    // RF32 — Historial de envíos (solo ADMIN)
    router.get('/historial', requiereRol('ADMIN'), async (req, res, next) => {
        try {
            const { ordenId, estado, desde } = req.query;
            const filtros = {};

            if (ordenId !== undefined) {
                if (!esIdValido(ordenId)) return res.status(400).json({ error: 'ordenId inválido' });
                filtros.ordenId = Number(ordenId);
            }
            if (estado !== undefined) {
                if (!ESTADOS_LOG.includes(estado)) {
                    return res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS_LOG.join(', ')}` });
                }
                filtros.estado = estado;
            }
            if (desde !== undefined) {
                const fecha = new Date(desde);
                if (Number.isNaN(fecha.getTime())) return res.status(400).json({ error: 'desde debe ser una fecha (YYYY-MM-DD)' });
                filtros.desde = fecha;
            }

            res.json(await store.findAll(filtros));
        } catch (error) {
            next(error);
        }
    });

    // QR para vincular WhatsApp desde el panel admin (solo ADMIN). El QR se genera aquí, sin servicios externos.
    router.get('/qr', requiereRol('ADMIN'), async (req, res, next) => {
        try {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            const estado = estadoWhatsapp();
            const qr = estado === 'CONECTADO' ? null : ultimoQr();
            res.json({
                whatsapp: ESTADO_WHATSAPP[estado] || estado,
                qr: qr ? await QRCode.toDataURL(qr, { width: 280, margin: 1 }) : null,
                detalle: errorWhatsapp(),
                timestamp: Date.now()
            });
        } catch (error) {
            next(error);
        }
    });

    // Endpoint para reiniciar la sesión de WhatsApp bajo demanda cuando el QR se atasque o expire
    router.post('/qr/reiniciar', requiereRol('ADMIN'), async (req, res, next) => {
        try {
            if (typeof reiniciarWhatsapp === 'function') {
                await reiniciarWhatsapp();
                return res.json({ ok: true, mensaje: 'Reinicio de sesión de WhatsApp solicitado con éxito' });
            }
            res.status(501).json({ ok: false, error: 'Reinicio no configurado' });
        } catch (error) {
            next(error);
        }
    });

    router.get('/status', (req, res) => {
        // Público: solo el estado, sin el detalle del fallo de arranque (que expone
        // hostnames y rutas internas). El detalle viaja por /qr, que exige ADMIN.
        const estado = estadoWhatsapp();
        const antiBaneo = typeof service.estadoAntiBaneo === 'function' ? service.estadoAntiBaneo() : null;
        res.json({
            status: 'ok',
            whatsapp: ESTADO_WHATSAPP[estado] || estado,
            colaPendiente: service.pendientes,
            // Extra informativo, sin romper el contrato anterior: qué está haciendo la cola
            // ahora y, si el anti-baneo está activo, si está pausada y por qué.
            cola: {
                enProceso: service.colaEnProceso,
                ultimoEnvioEn: service.ultimoEnvioEn,
                pausada: antiBaneo ? antiBaneo.pausada : false,
                motivo: antiBaneo ? antiBaneo.motivo : null
            },
            antiBaneo
        });
    });

    app.use('/api/notificaciones', router);

    // Página para escanear el QR desde el navegador.
    // Quien vea este QR puede vincular el WhatsApp de la pollería: solo se muestra desde la misma
    // máquina o con ?clave=<NOTIFICATION_API_KEY>. El QR se genera aquí, sin servicios externos.
    app.get('/qr', async (req, res, next) => {
        try {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            const desdeLocal = IPS_LOCALES.includes(req.socket.remoteAddress);
            const conClave = config.internalApiKey && req.query.clave === config.internalApiKey;
            if (!desdeLocal && !conClave) {
                return res.status(403).send(paginaQr('Acceso restringido',
                    '<p>Abre esta página desde el servidor o agrega ?clave=&lt;NOTIFICATION_API_KEY&gt;.</p>'));
            }

            if (estadoWhatsapp() === 'CONECTADO') {
                return res.send(paginaQr('WhatsApp ya está conectado', '<p>No se necesita escanear un QR.</p>'));
            }

            const qr = ultimoQr();
            const fallo = errorWhatsapp();
            if (!qr && fallo) {
                return res.send(paginaQr('WhatsApp no pudo arrancar',
                    `<p>${escaparHtml(fallo)}</p><p>Reinicia el servicio de notificaciones. Si el fallo se repite, detén el servicio y borra la carpeta de sesión para volver a vincular.</p>`, 10));
            }

            if (!qr) {
                return res.send(paginaQr('Generando el QR...', '<p>La página se recarga sola en 5 segundos.</p>', 5));
            }

            const imagen = await QRCode.toDataURL(qr, { width: 300, margin: 1 });
            res.send(paginaQr('Escanea con WhatsApp',
                `<img src="${imagen}" width="300" height="300" alt="Código QR de WhatsApp">
<p>WhatsApp → Dispositivos vinculados → Vincular un dispositivo.<br>La página se actualiza cada 25 segundos.</p>`, 25));
        } catch (error) {
            next(error);
        }
    });

    app.use((error, req, res, next) => {
        console.error('❌ Error no controlado:', error);
        res.status(500).json({ error: 'Error interno del servicio de notificaciones' });
    });

    return app;
}

module.exports = { crearApp };
