const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

function comparacionConstante(provista, esperada) {
    if (typeof provista !== 'string' || typeof esperada !== 'string' || esperada.length === 0) {
        return false;
    }
    const bufA = Buffer.from(provista, 'utf8');
    const bufB = Buffer.from(esperada, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

// Valida el JWT emitido por auth-service (mismo JWT_SECRET) y exige uno de los roles
function requiereRol(...roles) {
    return (req, res, next) => {
        if (!config.jwtSecret) {
            return res.status(500).json({ error: 'JWT_SECRET no configurado en notification-service' });
        }

        const header = req.headers.authorization || '';
        if (!header.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token requerido' });
        }

        try {
            const claims = jwt.verify(header.slice(7), config.jwtSecret, {
                algorithms: ['HS256', 'HS384', 'HS512']
            });
            if (claims && claims.tipo === 'seguimiento') {
                return res.status(401).json({ error: 'Token inválido o expirado' });
            }
            if (!roles.includes(claims.role)) {
                return res.status(403).json({ error: 'No tienes permisos para este recurso' });
            }
            req.usuario = claims;
            next();
        } catch (error) {
            return res.status(401).json({ error: 'Token inválido o expirado' });
        }
    };
}

// Protege los endpoints que llaman orders-service y payments-service (fail-closed si falta clave)
function requiereClaveInterna(req, res, next) {
    if (!config.internalApiKey) {
        return res.status(500).json({ error: 'NOTIFICATION_API_KEY no configurada en notification-service' });
    }

    if (!comparacionConstante(req.headers['x-internal-key'], config.internalApiKey)) {
        return res.status(401).json({ error: 'Clave interna inválida' });
    }
    next();
}

module.exports = { requiereRol, requiereClaveInterna, comparacionConstante };
