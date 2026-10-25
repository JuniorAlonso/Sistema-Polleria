/**
 * Almacenamiento de los comprobantes de Yape en MinIO (T6b, S7).
 *
 * El notification-service descarga la imagen que llega por WhatsApp y la sube al bucket
 * con el cliente oficial `minio`. La convención de clave es
 * `comprobantes/yape/{ordenId}/{timestamp}-{messageId}.{ext}`: ordena por pedido, evita
 * pisar una reentrega (el timestamp y el id del mensaje la distinguen) y `payments-service`
 * guarda solo esa referencia opaca (T6a), nunca el archivo.
 *
 * El bucket se crea si falta. El cliente MinIO es inyectable para que los tests sean
 * deterministas y no toquen la red ni requieran un MinIO real; el reloj también se inyecta.
 *
 * `require('minio')` es perezoso (solo al construir el cliente real) para que los tests que
 * inyectan un doble no necesiten la dependencia instalada.
 */

const BUCKET_POR_DEFECTO = 'polleria-comprobantes';

/** Extensiones conocidas por mimetype; si no está, se deduce del nombre del archivo. */
const EXTENSIONES = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/tiff': 'tiff'
};

/** ¿El mimetype corresponde a una imagen? (se usa para rechazar lo que no lo sea). */
function esImagen(mimetype) {
    return typeof mimetype === 'string' && mimetype.toLowerCase().startsWith('image/');
}

/** Extensión del objeto: por mimetype y, si no se reconoce, por el nombre del archivo. */
function extensionDe(mimetype, nombreArchivo) {
    const tipo = String(mimetype || '').toLowerCase().split(';')[0].trim();
    if (EXTENSIONES[tipo]) return EXTENSIONES[tipo];
    const delNombre = String(nombreArchivo || '').match(/\.([a-z0-9]+)$/i);
    if (delNombre) return delNombre[1].toLowerCase();
    if (tipo.includes('/')) {
        const sufijo = tipo.split('/')[1].replace(/[^a-z0-9]/g, '');
        if (sufijo) return sufijo;
    }
    return 'bin';
}

const { crearLogger } = require('../logger');
const logger = crearLogger('MinIO');

class AlmacenamientoComprobantes {
    constructor({ cliente, bucket = BUCKET_POR_DEFECTO, ahora = Date.now, endpoint, port, useSSL } = {}) {
        this.cliente = cliente;
        this.bucket = bucket;
        this.ahora = ahora;
        this.endpoint = endpoint;
        this.port = port;
        this.useSSL = useSSL;
        this.bucketListo = false;
    }

    /** Garantiza que el bucket exista antes de subir; lo crea si falta. */
    async asegurarBucket() {
        if (this.bucketListo) return;
        try {
            logger.debug(`Verificando existencia del bucket "${this.bucket}"...`);
            const existe = await this.cliente.bucketExists(this.bucket);
            if (!existe) {
                logger.info(`Bucket "${this.bucket}" no existe en MinIO. Creándolo con makeBucket()...`);
                await this.cliente.makeBucket(this.bucket);
                logger.success(`Bucket "${this.bucket}" creado exitosamente.`);
            } else {
                logger.debug(`Bucket "${this.bucket}" verificado (ya existe).`);
            }
            this.bucketListo = true;
        } catch (error) {
            logger.error(`Error al verificar/asegurar bucket "${this.bucket}": ${error.message}`);
            throw error;
        }
    }

    /** Clave del objeto en el bucket (pura, para reutilizarla y testearla). */
    claveDe({ ordenId, messageId, timestamp, extension }) {
        return `comprobantes/yape/${ordenId}/${timestamp}-${messageId}.${extension}`;
    }

    /**
     * Sube el archivo y devuelve la clave del objeto. Lanza si MinIO falla, para que el
     * bot avise y pida reenviar en vez de inventar un éxito.
     */
    async subir({ ordenId, messageId, archivo, contentType, nombreArchivo } = {}) {
        if (ordenId === undefined || ordenId === null) {
            logger.error('Intento de subida sin ordenId');
            throw new Error('ordenId requerido para subir el comprobante');
        }
        if (!archivo || !archivo.length) {
            logger.error(`Intento de subida para orden #${ordenId} sin archivo o archivo vacío`);
            throw new Error('archivo requerido para subir el comprobante');
        }

        logger.info(`Preparando subida de comprobante para orden #${ordenId} (tamaño archivo: ${archivo.length} bytes, tipo declarado: ${contentType})`);
        await this.asegurarBucket();

        const extension = extensionDe(contentType, nombreArchivo);
        const timestamp = this.ahora();
        const clave = this.claveDe({ ordenId, messageId, timestamp, extension });
        const cuerpo = Buffer.isBuffer(archivo) ? archivo : Buffer.from(archivo);
        const tipo = contentType || 'application/octet-stream';

        logger.info(`Subiendo a MinIO: bucket="${this.bucket}", clave="${clave}", tamaño=${cuerpo.length} bytes, Content-Type="${tipo}"`);
        try {
            await this.cliente.putObject(this.bucket, clave, cuerpo, cuerpo.length, {
                'Content-Type': tipo
            });
            logger.success(`Imagen subida exitosamente a MinIO con clave: "${clave}" (${cuerpo.length} bytes)`);
            return clave;
        } catch (error) {
            logger.error(`Fallo en putObject a MinIO (bucket="${this.bucket}", clave="${clave}"): ${error.message}`);
            throw error;
        }
    }
}

/** Construye el cliente oficial de MinIO. Solo se llama cuando no se inyecta un doble. */
function crearClienteMinio({ endpoint, port, useSSL, accessKey, secretKey } = {}) {
    const Minio = require('minio');
    logger.info(`Inicializando cliente oficial MinIO -> ${useSSL ? 'https' : 'http'}://${endpoint}:${port} (accessKey: ${accessKey ? accessKey.slice(0, 3) + '***' : 'no definida'})`);
    return new Minio.Client({
        endPoint: endpoint,
        port,
        useSSL,
        accessKey,
        secretKey
    });
}

/**
 * @param cliente  doble inyectable para los tests (sin red real)
 * @param bucket   nombre del bucket (MINIO_BUCKET)
 * @param ahora    reloj del `timestamp` de la clave (inyectable en tests)
 * @param endpoint/port/useSSL/accessKey/secretKey  configuración del cliente real
 */
function crearAlmacenamiento({ cliente, bucket, ahora, endpoint, port, useSSL, accessKey, secretKey } = {}) {
    const minio = cliente || crearClienteMinio({ endpoint, port, useSSL, accessKey, secretKey });
    return new AlmacenamientoComprobantes({ cliente: minio, bucket, ahora, endpoint, port, useSSL });
}

module.exports = {
    BUCKET_POR_DEFECTO,
    AlmacenamientoComprobantes,
    crearAlmacenamiento,
    crearClienteMinio,
    esImagen,
    extensionDe
};
