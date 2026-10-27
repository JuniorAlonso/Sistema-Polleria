-- ============================================================
-- SCRIPT DE SEMILLAS PARA DESARROLLO LOCAL (POLLERÍA SAN POLLO)
-- Añade:
-- 1. Carta completa de Productos con imágenes locales de /assets/images/
-- 2. Insumos del Almacén Central de Inventario
-- 3. Despachos y Lotes de Insumos hacia Cocina (RF23)
-- 4. Registro de Mermas por vencimiento de lote (RF24)
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. PRODUCTOS DE LA CARTA (10 PLATOS CON SUS IMÁGENES ASOCIADAS)
-- ------------------------------------------------------------
INSERT INTO productos (id, nombre, descripcion, precio, categoria, imagen_url, disponible, creado_en)
VALUES 
    (1, '1/4 Pollo a la Brasa Clásico', '1/4 de pollo dorado al carbón con crujientes papas fritas y ensalada clásica con vinagreta de la casa.', 24.50, 'CUARTO_POLLO', '/assets/images/cuarto-pollo.jpg', true, NOW()),
    (2, '1/2 Pollo a la Brasa Familiar', '1/2 pollo a la brasa jugoso, porción generosa de papas fritas y ensalada clásica de la casa.', 42.00, 'MEDIO_POLLO', '/assets/images/medio-pollo.jpg', true, NOW()),
    (3, '1 Pollo a la Brasa San Pollo Especial', 'Pollo entero macerado con la receta secreta tradicional al carbón de algarrobo, papas familiares y ensalada mixta.', 69.90, 'POLLO_ENTERO', '/assets/images/hero-panoramic.jpg', true, NOW()),
    (4, 'Combo Pollero 1 y 1/2 Pollo', '1 1/2 pollos a la brasa + papas familiares abundantes + ensalada grande + cremas artesanales.', 95.00, 'COMBO', '/assets/images/combo-uno-y-medio.jpg', true, NOW()),
    (5, 'Combo Urbano Máximo Parrillero', '1 Pollo entero + papas fritas familiares + ensalada fresca + 1L chicha morada + 4 salsas artesanales.', 84.90, 'COMBO', '/assets/images/combo-urbano-maximo.jpg', true, NOW()),
    (6, 'Anticuchos Parrilleros Selectos (2 palos)', '2 palos de corazón macerados al ají panca y especias peruanas, acompañados de papas doradas y choclo tierno.', 28.00, 'PARRILLA', '/assets/images/anticuchos-parrilleros.jpg', true, NOW()),
    (7, 'Salchipapa Artesanal Criolla', 'Papas amarillas crocantes con rodajas de salchicha frankfurter seleccionada y cremas peruanas.', 19.50, 'GUARNICION', '/assets/images/salchipapa-artesanal.jpg', true, NOW()),
    (8, 'Tequeños Rellenos con Guacamole (8 uds)', '8 crocantes tequeños rellenos de queso andino y pollo brasa deshilachado con guacamole fresco.', 22.00, 'GUARNICION', '/assets/images/tequenos-guacamole.jpg', true, NOW()),
    (9, 'Chicha Morada de la Casa (1L)', 'Elaborada tradicionalmente con maíz morado, piña golden, manzana, canela, clavo de olor y gotas de limón.', 14.00, 'BEBIDA', '/assets/images/chicha-morada.jpg', true, NOW()),
    (10, 'Banquete Pollero San Pollo', 'Mega banquete: 1 Pollo entero + porción de tequeños + papas familiares + ensalada + bebida 1.5L.', 89.90, 'PROMOCION', '/assets/images/login-hero.jpg', true, NOW())
ON CONFLICT (id) DO UPDATE 
SET nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    precio = EXCLUDED.precio,
    categoria = EXCLUDED.categoria,
    imagen_url = EXCLUDED.imagen_url,
    disponible = EXCLUDED.disponible,
    actualizado_en = NOW();

-- Si habían duplicados temporales por pruebas anteriores, eliminarlos
DELETE FROM productos WHERE id IN (11, 12);

-- Ajustar la secuencia de productos
SELECT setval(pg_get_serial_sequence('productos', 'id'), COALESCE(MAX(id), 1)) FROM productos;

-- ------------------------------------------------------------
-- 2. INSUMOS DE ALMACÉN CENTRAL (INVENTORY-SERVICE)
-- ------------------------------------------------------------
INSERT INTO insumos (nombre, unidad_medida, stock_actual, stock_minimo_alerta, costo_unitario)
VALUES 
    ('Pollo Entero Fresco Eviscerado (Calibre 2.2kg)', 'UNIDAD', 120.00, 25.00, 18.50),
    ('Papa Amarilla Seleccionada para Fritura', 'KG', 250.00, 50.00, 3.80),
    ('Carbón Vegetal de Algarrobo', 'KG', 300.00, 60.00, 3.20),
    ('Aceite Vegetal para Fritura Profunda', 'LITRO', 80.00, 20.00, 7.50),
    ('Corazón de Res Marinado para Anticuchos', 'KG', 35.00, 10.00, 22.00),
    ('Maíz Morado Culli Seleccionado', 'KG', 50.00, 12.00, 5.50),
    ('Masa Wantán y Queso Andino (Tequeños)', 'UNIDAD', 180.00, 40.00, 0.80),
    ('Salchicha Frankfurter Ahumada', 'KG', 30.00, 8.00, 16.00),
    ('Ají Amarillo y Rocoto (Base Cremas)', 'KG', 40.00, 10.00, 4.50),
    ('Verduras Frescas para Ensalada (Lechuga/Tomate)', 'KG', 55.00, 15.00, 3.00)
ON CONFLICT (nombre) DO UPDATE 
SET stock_actual = EXCLUDED.stock_actual,
    stock_minimo_alerta = EXCLUDED.stock_minimo_alerta,
    costo_unitario = EXCLUDED.costo_unitario;

-- Ajustar la secuencia de insumos
SELECT setval(pg_get_serial_sequence('insumos', 'id'), COALESCE(MAX(id), 1)) FROM insumos;

-- ------------------------------------------------------------
-- 3. DESPACHOS Y LOTES DE INSUMOS HACIA COCINA (RF23)
-- ------------------------------------------------------------
DELETE FROM despacho_items WHERE observaciones LIKE 'Lote LOT-%';
DELETE FROM despachos_cocina WHERE solicitante_nombre LIKE 'Chef Mario%';

-- Despacho 1: Horno de Brasa
INSERT INTO despachos_cocina (solicitante_id, solicitante_nombre, fecha_despacho)
VALUES (4, 'Chef Mario - Horno de Brasa', NOW() - INTERVAL '3 hours');

INSERT INTO despacho_items (despacho_id, insumo_id, insumo_nombre, cantidad, observaciones)
SELECT 
    currval(pg_get_serial_sequence('despachos_cocina', 'id')),
    id,
    nombre,
    30.00,
    'Lote LOT-POL-2408 (30 aves calibre 2.2kg) - Estación Horno Principal'
FROM insumos WHERE nombre = 'Pollo Entero Fresco Eviscerado (Calibre 2.2kg)';

INSERT INTO despacho_items (despacho_id, insumo_id, insumo_nombre, cantidad, observaciones)
SELECT 
    currval(pg_get_serial_sequence('despachos_cocina', 'id')),
    id,
    nombre,
    75.00,
    'Lote LOT-CAR-0044 (3 sacos x 25kg) - Carga Horno de Brasa'
FROM insumos WHERE nombre = 'Carbón Vegetal de Algarrobo';

-- Despacho 2: Cocina Caliente & Fritura
INSERT INTO despachos_cocina (solicitante_id, solicitante_nombre, fecha_despacho)
VALUES (4, 'Chef Mario - Cocina Caliente', NOW() - INTERVAL '2 hours');

INSERT INTO despacho_items (despacho_id, insumo_id, insumo_nombre, cantidad, observaciones)
SELECT 
    currval(pg_get_serial_sequence('despachos_cocina', 'id')),
    id,
    nombre,
    50.00,
    'Lote LOT-PAP-1102 (50 kg seleccionada) - Pelado y corte para fritura'
FROM insumos WHERE nombre = 'Papa Amarilla Seleccionada para Fritura';

INSERT INTO despacho_items (despacho_id, insumo_id, insumo_nombre, cantidad, observaciones)
SELECT 
    currval(pg_get_serial_sequence('despachos_cocina', 'id')),
    id,
    nombre,
    15.00,
    'Lote LOT-ACE-3021 (Bidón 15L) - Recambio freidoras automáticas'
FROM insumos WHERE nombre = 'Aceite Vegetal para Fritura Profunda';

-- Despacho 3: Parrilla y Bar
INSERT INTO despachos_cocina (solicitante_id, solicitante_nombre, fecha_despacho)
VALUES (4, 'Chef Mario - Parrilla y Bar', NOW() - INTERVAL '45 minutes');

INSERT INTO despacho_items (despacho_id, insumo_id, insumo_nombre, cantidad, observaciones)
SELECT 
    currval(pg_get_serial_sequence('despachos_cocina', 'id')),
    id,
    nombre,
    12.00,
    'Lote LOT-ANT-0815 (12 kg en brochetas) - Estación Parrilla'
FROM insumos WHERE nombre = 'Corazón de Res Marinado para Anticuchos';

INSERT INTO despacho_items (despacho_id, insumo_id, insumo_nombre, cantidad, observaciones)
SELECT 
    currval(pg_get_serial_sequence('despachos_cocina', 'id')),
    id,
    nombre,
    10.00,
    'Lote LOT-CHI-1204 (10 kg maíz culli) - Preparación Chicha Morada 50L'
FROM insumos WHERE nombre = 'Maíz Morado Culli Seleccionado';

-- ------------------------------------------------------------
-- 4. MERMAS DE INSUMOS POR CONTROL DE CALIDAD Y VENCIMIENTO (RF24)
-- ------------------------------------------------------------
DELETE FROM mermas WHERE justificacion LIKE '%Lote LOT-%';

INSERT INTO mermas (insumo_id, insumo_nombre, cantidad, motivo, justificacion, registrado_por, fecha)
SELECT 
    id,
    nombre,
    2.50,
    'VENCIMIENTO',
    'Vencimiento de Lote LOT-PAP-1090 por exceso de humedad en almacén',
    4,
    NOW() - INTERVAL '1 day'
FROM insumos WHERE nombre = 'Papa Amarilla Seleccionada para Fritura';

INSERT INTO mermas (insumo_id, insumo_nombre, cantidad, motivo, justificacion, registrado_por, fecha)
SELECT 
    id,
    nombre,
    1.00,
    'ERROR_COCINA',
    'Sobre-cocción de 1 pollo en horno de Lote LOT-POL-2408',
    4,
    NOW() - INTERVAL '5 hours'
FROM insumos WHERE nombre = 'Pollo Entero Fresco Eviscerado (Calibre 2.2kg)';

-- ------------------------------------------------------------
-- 5. EXTENSIÓN DE ESQUEMA OPERATIVO: DELIVERY, RECOJO, COMPROBANTES Y SANCIONES
-- ------------------------------------------------------------

-- Columnas operativas en ordenes para SLAs, motorizado en puerta y contrapago
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS en_puerta_at TIMESTAMP;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS listo_at TIMESTAMP;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS intentos_llamada INT DEFAULT 0;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS llamada_confirmacion_at TIMESTAMP;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS monto_paga_con NUMERIC(10, 2);
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS vuelto_estimado NUMERIC(10, 2);
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS motivo_fantasma VARCHAR(30);
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS ip_origen VARCHAR(45);
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS requiere_cobro_efectivo BOOLEAN NOT NULL DEFAULT FALSE;

-- ddl-auto=update freezes the estado CHECK with the enum values of the first start; without the
-- payment/confirmation states every Yape and ContraPago order is rejected. orders-service also
-- rebuilds it on start (InicializadorEstadoOrdenCheck); this keeps a manual load consistent.
ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS ordenes_estado_check;
ALTER TABLE ordenes ADD CONSTRAINT ordenes_estado_check CHECK (estado IN (
    'RECIBIDO', 'PENDIENTE_CONFIRMACION', 'PENDIENTE_PAGO', 'EN_PREPARACION', 'PREPARANDO', 'LISTO',
    'LISTO_PARA_ENTREGAR', 'EN_CAMINO', 'EN_PUERTA', 'ENTREGADO', 'CANCELADO', 'PEDIDO_FANTASMA'));

-- Pagos (payments-service). comprobante_clave holds the object-storage key of the Yape/Plin capture.
-- The estado CHECK is realigned at startup by InicializadorEstadoPago.
CREATE TABLE IF NOT EXISTS pagos (
    id                 BIGSERIAL PRIMARY KEY,
    orden_id           BIGINT        NOT NULL,
    cliente_id         BIGINT        NOT NULL,
    monto              NUMERIC(38, 2) NOT NULL,
    metodo_pago        VARCHAR(20)   NOT NULL,
    estado             VARCHAR(30)   NOT NULL DEFAULT 'PENDIENTE',
    referencia_externa VARCHAR(100),
    detalle            VARCHAR(500),
    checkout_url       VARCHAR(500),
    comprobante_clave  VARCHAR(300),
    verificado_por     VARCHAR(100),
    verificado_en      TIMESTAMP,
    motivo_rechazo     VARCHAR(300),
    creado_en          TIMESTAMP     NOT NULL DEFAULT NOW(),
    actualizado_en     TIMESTAMP,
    version            BIGINT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pagos_orden_id ON pagos (orden_id);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos (estado);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente_id ON pagos (cliente_id);

-- Comprobantes de pago (Boleta / Factura en finance-service)
CREATE TABLE IF NOT EXISTS comprobantes_pago (
    id                  BIGSERIAL PRIMARY KEY,
    orden_id            BIGINT NOT NULL,
    tipo                VARCHAR(20) NOT NULL, -- BOLETA, FACTURA
    serie_correlativo   VARCHAR(30) NOT NULL UNIQUE,
    cliente_tipo_doc    VARCHAR(10), -- DNI, RUC
    cliente_num_doc     VARCHAR(20),
    cliente_nombre      VARCHAR(150) NOT NULL,
    cliente_direccion   VARCHAR(300),
    subtotal            NUMERIC(10, 2) NOT NULL,
    igv                 NUMERIC(10, 2) NOT NULL,
    total               NUMERIC(10, 2) NOT NULL,
    estado_pago_texto   VARCHAR(50) NOT NULL, -- "PAGADO", "COBRAR EN EFECTIVO: S/ XX.XX"
    vuelto_entregado    NUMERIC(10, 2) DEFAULT 0.00,
    emitido_en          TIMESTAMP NOT NULL DEFAULT NOW(),
    emitido_por         BIGINT
);
CREATE INDEX IF NOT EXISTS idx_comprobantes_orden_id ON comprobantes_pago(orden_id);

-- Liquidación de efectivo de repartidores (finance-service)
CREATE TABLE IF NOT EXISTS liquidaciones_repartidores (
    id                      BIGSERIAL PRIMARY KEY,
    repartidor_id           BIGINT NOT NULL,
    repartidor_nombre       VARCHAR(100) NOT NULL,
    arqueo_caja_id          BIGINT,
    fondo_inicial           NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_cobrado_efectivo  NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_rendido           NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    diferencia              NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    estado                  VARCHAR(20) NOT NULL DEFAULT 'ABIERTA', -- ABIERTA, CERRADA, DISCREPANCIA
    observaciones           VARCHAR(500),
    creado_en               TIMESTAMP NOT NULL DEFAULT NOW(),
    cerrado_en              TIMESTAMP,
    cerrado_por             BIGINT
);
CREATE INDEX IF NOT EXISTS idx_liquidaciones_repartidor ON liquidaciones_repartidores(repartidor_id);
CREATE INDEX IF NOT EXISTS idx_liquidaciones_estado ON liquidaciones_repartidores(estado);

-- Courier cash settlement: expected cash comes from payments (cobro-efectivo) instead of typed by hand
ALTER TABLE liquidaciones_repartidores ADD COLUMN IF NOT EXISTS total_esperado_efectivo NUMERIC(10, 2);
ALTER TABLE liquidaciones_repartidores ADD COLUMN IF NOT EXISTS diferencia_efectivo NUMERIC(10, 2);
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS repartidor_id BIGINT;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS liquidacion_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_pagos_repartidor_id ON pagos (repartidor_id);

-- Sanciones y bloqueos permanentes de cliente (auth-service / incident-service)
CREATE TABLE IF NOT EXISTS sanciones_cliente (
    id                   BIGSERIAL PRIMARY KEY,
    telefono             VARCHAR(30),
    telefono_normalizado VARCHAR(20),
    email                VARCHAR(150),
    ip_address           VARCHAR(45),
    motivo               VARCHAR(255) NOT NULL,
    orden_id             BIGINT,
    bloqueado_efectivo   BOOLEAN NOT NULL DEFAULT TRUE,
    bloqueado_total      BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en            TIMESTAMP NOT NULL DEFAULT NOW(),
    creado_por           VARCHAR(100) DEFAULT 'SISTEMA_PEDIDO_FANTASMA'
);
CREATE INDEX IF NOT EXISTS idx_sanciones_telefono_norm ON sanciones_cliente(telefono_normalizado);
CREATE INDEX IF NOT EXISTS idx_sanciones_email ON sanciones_cliente(email);
CREATE INDEX IF NOT EXISTS idx_sanciones_ip ON sanciones_cliente(ip_address);

COMMIT;