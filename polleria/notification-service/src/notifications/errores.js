const PATRON_DESCONEXION =
    /tiempo de espera agotado.*esperando conexi[oó]n|whatsapp desconectado|session closed|target closed|execution context was destroyed|protocol error.*(?:session|target)|not ready/i;

class WhatsappDesconectadoError extends Error {
    constructor(mensaje = 'WhatsApp desconectado') {
        super(mensaje);
        this.name = 'WhatsappDesconectadoError';
        this.esDesconexion = true;
    }
}

function esErrorDeDesconexion(error, whatsapp) {
    if (error && (error.esDesconexion === true || error.name === 'WhatsappDesconectadoError')) {
        return true;
    }
    if (whatsapp && typeof whatsapp.estado === 'function' && whatsapp.estado() !== 'CONECTADO') {
        return true;
    }
    return Boolean(error && typeof error.message === 'string' && PATRON_DESCONEXION.test(error.message));
}

module.exports = {
    WhatsappDesconectadoError,
    esErrorDeDesconexion
};
