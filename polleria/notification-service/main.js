const config = require('./src/config');
const { client, whatsapp, reiniciarSesion } = require('./src/whatsapp/client');
const handleMessage = require('./src/whatsapp/handler');
const { crearStore } = require('./src/notifications/store');
const { NotificacionService } = require('./src/notifications/service');
const { crearApp } = require('./src/http/app');

async function main() {
    const store = crearStore(config.databaseUrl);
    await store.init();
    if (!config.databaseUrl) {
        console.warn('⚠️ DATABASE_URL no definido: el historial se guardará solo en memoria');
    }

    const service = new NotificacionService({
        store,
        whatsapp,
        intervaloMs: config.rateLimitMs,
        maxIntentos: config.maxIntentos
    });

    const recuperados = await service.recuperarPendientes();
    if (recuperados > 0) {
        console.log(`🔁 ${recuperados} notificaciones pendientes vueltas a encolar`);
    }

    const app = crearApp({ service, store, estadoWhatsapp: whatsapp.estado, ultimoQr: whatsapp.ultimoQr });
    app.listen(config.port, () => {
        console.log(`🚀 Notification service en puerto ${config.port} (delay entre mensajes: ${config.rateLimitMs} ms)`);
    });

    client.on('message', handleMessage);
    client.initialize();
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
    console.error('❌ Error no controlado de WhatsApp:', mensaje);
});

main().catch(error => {
    console.error('❌ No se pudo iniciar notification-service:', error);
    process.exit(1);
});
