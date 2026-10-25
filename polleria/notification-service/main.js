const config = require('./src/config');
const { client, whatsapp, reiniciarSesion, arrancar } = require('./src/whatsapp/client');
const handleMessage = require('./src/whatsapp/handler');
const { crearStore } = require('./src/notifications/store');
const { NotificacionService } = require('./src/notifications/service');
const { crearAjustes } = require('./src/outbound/ajustes');
const { crearGobernador } = require('./src/outbound/gobernador');
const { crearApp } = require('./src/http/app');
const { crearConversationStore } = require('./src/chatbot/conversation');
const { crearBot } = require('./src/chatbot/chatbot');
const { crearCatalogo } = require('./src/pedidos/catalogo');
const { crearClienteOrdenes } = require('./src/pedidos/ordenes');
const { crearAlmacenamiento } = require('./src/pedidos/almacenamiento');
const { crearClientePagos } = require('./src/pedidos/pagos');

async function main() {
    const store = crearStore(config.databaseUrl);
    await store.init();
    if (!config.databaseUrl) {
        console.warn('⚠️ DATABASE_URL no definido: el historial se guardará solo en memoria');
    }

    // Estado de conversación del bot (T3a): misma base que el historial y mismo
    // fallback en memoria cuando no hay DATABASE_URL, así sobrevive al reinicio.
    const conversacion = crearConversationStore(config.databaseUrl);
    await conversacion.init();
    if (!config.databaseUrl) {
        console.warn('⚠️ DATABASE_URL no definido: el estado de conversación se guardará solo en memoria');
    }

    // Ajustes anti-baneo en memoria (S8): arrancan con los defaults de entorno y el
    // panel (T5) los editará en caliente. Se pierden al reiniciar el proceso.
    const ajustes = crearAjustes(config.antiBaneo);

    // Catálogo real de orders-service (T3a): el bot lee GET /productos con cache corto
    // y, si el servicio no responde, avisa y ofrece el asesor en vez de inventar carta.
    const catalogo = crearCatalogo({
        baseUrl: config.ordersServiceUrl,
        ttlMs: config.catalogoTtlMs
    });

    // Alta del pedido anónimo (T3b): el bot crea el DELIVERY con POST /ordenes y usa el
    // total que devuelve orders-service (el envío lo suma Orden.recalcularTotal()).
    const ordenes = crearClienteOrdenes({ baseUrl: config.ordersServiceUrl });

    // Comprobante de Yape (T6b, S6/S7): el bot sube la imagen a MinIO y registra la
    // evidencia en payments-service (POST /pagos/comprobante con X-Internal-Key).
    const almacenamiento = crearAlmacenamiento({
        endpoint: config.minio.endpoint,
        port: config.minio.port,
        useSSL: config.minio.useSSL,
        accessKey: config.minio.accessKey,
        secretKey: config.minio.secretKey,
        bucket: config.minio.bucket
    });
    const pagos = crearClientePagos({
        baseUrl: config.paymentsServiceUrl,
        internalKey: config.internalKeyCompartida
    });

    const bot = crearBot({ catalogo, ajustes, conversacion, ordenes, almacenamiento, pagos });

    // Gobernador anti-baneo (T4b): presupuesto por hora/día, ventana horaria y circuit
    // breaker. La cola lo consulta antes de cada envío y /status expone su estado.
    const gobernador = crearGobernador({ ajustes });

    const service = new NotificacionService({
        store,
        whatsapp,
        ajustes,
        gobernador,
        maxIntentos: config.maxIntentos
    });

    const recuperados = await service.recuperarPendientes();
    if (recuperados > 0) {
        console.log(`🔁 ${recuperados} notificaciones pendientes vueltas a encolar`);
    }

    const app = crearApp({
        service,
        store,
        estadoWhatsapp: whatsapp.estado,
        ultimoQr: whatsapp.ultimoQr,
        errorWhatsapp: whatsapp.ultimoError,
        reiniciarWhatsapp: reiniciarSesion
    });
    app.listen(config.port, () => {
        const { intervaloMs, jitterPct, presupuestoHora, presupuestoDia, horaDesde, horaHasta } = ajustes.obtener();
        console.log(`\n======================================================`);
        console.log(`🚀 Notification service en puerto ${config.port} (delay base entre mensajes: ${intervaloMs} ms, jitter ±${jitterPct}%)`);
        console.log(`🛡️ Anti-baneo: ${presupuestoHora}/hora, ${presupuestoDia}/día, ventana ${horaDesde}:00-${horaHasta}:00`);
        console.log(`☁️ MinIO: ${config.minio.useSSL ? 'https' : 'http'}://${config.minio.endpoint}:${config.minio.port} (bucket: "${config.minio.bucket}")`);
        console.log(`💳 Payments Service: ${config.paymentsServiceUrl} (X-Internal-Key: ${config.internalKeyCompartida ? 'Configurada' : 'NO DEFINIDA - riesgo de 401'})`);
        console.log(`📦 Orders Service: ${config.ordersServiceUrl}`);
        console.log(`🗄️ Base de datos: ${config.databaseUrl ? 'PostgreSQL' : 'En memoria (sin persistencia)'}`);
        console.log(`======================================================\n`);
    });

    // El handler encola la respuesta del bot en la misma cola saliente (S2).
    client.on('message', msg => {
        console.log(`\n📩 [WhatsApp] Mensaje entrante recibido en cliente (from: ${msg.from}, tipo: ${msg.type}, hasMedia: ${Boolean(msg.hasMedia)})`);
        handleMessage(msg, { service, bot });
    });

    client.on('message_create', msg => {
        if (msg.fromMe && msg.to && msg.from && (msg.to === msg.from || msg.to.split('@')[0] === msg.from.split('@')[0])) {
            console.log(`ℹ️ [WhatsApp] Auto-mensaje propio detectado (hasMedia: ${Boolean(msg.hasMedia)}). Nota: whatsapp-web.js no dispara 'message' para mensajes propios.`);
        }
    });

    // arrancar() reintenta solo cuando Chromium no puede lanzarse (por ejemplo por un
    // SingletonLock heredado de un contenedor anterior) y deja el motivo en /status.
    arrancar();
}

// Un error interno de puppeteer/whatsapp-web.js no debe tumbar el servicio ni perder la cola
process.on('unhandledRejection', error => {
    const mensaje = error && error.message ? error.message : String(error);

    // En Windows, al cerrarse la sesión LocalAuth no puede borrar la carpeta porque Chrome la tiene abierta (EBUSY).
    // Hay que cerrar Chrome antes de borrarla y volver a iniciar; si no, queda en bucle.
    if (mensaje.includes('EBUSY')) {
        console.warn('⚠️ Sesión de WhatsApp bloqueada (EBUSY). Cerrando el navegador para empezar con una sesión nueva...');
        reiniciarSesion();
        return;
    }

    // Perfil de Chromium bloqueado o navegador que no arranca: reintentar limpiando el lock.
    // Sin esto el servicio queda en INICIANDO para siempre y el QR nunca aparece.
    if (mensaje.includes('Failed to launch the browser process') ||
        mensaje.includes('profile appears to be in use')) {
        console.warn('⚠️ El navegador de WhatsApp no arrancó. Reintentando con el perfil limpio...');
        arrancar();
        return;
    }

    console.error('❌ Error no controlado de WhatsApp:', mensaje);
});

main().catch(error => {
    console.error('❌ No se pudo iniciar notification-service:', error);
    process.exit(1);
});
