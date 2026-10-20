const config = require('./src/config');
const { client, whatsapp, reiniciarSesion, arrancar } = require('./src/whatsapp/client');
const handleMessage = require('./src/whatsapp/handler');
const { crearStore } = require('./src/notifications/store');
const { NotificacionService } = require('./src/notifications/service');
const { crearAjustes } = require('./src/outbound/ajustes');
const { crearApp } = require('./src/http/app');

async function main() {
    const store = crearStore(config.databaseUrl);
    await store.init();
    if (!config.databaseUrl) {
        console.warn('⚠️ DATABASE_URL no definido: el historial se guardará solo en memoria');
    }

    // Ajustes anti-baneo en memoria (S8): arrancan con los defaults de entorno y el
    // panel (T5) los editará en caliente. Se pierden al reiniciar el proceso.
    const ajustes = crearAjustes(config.antiBaneo);

    const service = new NotificacionService({
        store,
        whatsapp,
        ajustes,
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
        errorWhatsapp: whatsapp.ultimoError
    });
    app.listen(config.port, () => {
        const { intervaloMs, jitterPct } = ajustes.obtener();
        console.log(`🚀 Notification service en puerto ${config.port} (delay base entre mensajes: ${intervaloMs} ms, jitter ±${jitterPct}%)`);
    });

    // El handler encola la respuesta del chatbot en la misma cola saliente (S2).
    client.on('message', msg => handleMessage(msg, { service }));
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
