const jwt = require('jsonwebtoken');
const config = require('../config');

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

// Protege los endpoints que llaman orders-service y payments-service
function requiereClaveInterna(req, res, next) {
    if (!config.internalApiKey) return next();

    if (req.headers['x-internal-key'] !== config.internalApiKey) {
        return res.status(401).json({ error: 'Clave interna inválida' });
    }
    next();
}

module.exports = { requiereRol, requiereClaveInterna };
