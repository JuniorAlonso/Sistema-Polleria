// MOCK: datos ficticios de despacho de insumos y mermas. No hay backend para esto todavia.

export interface DespachoLoteInsumo {
  id: string;
  codigoLote: string;
  insumo: string;
  cantidad: string;
  solicitadoPor: string;
  hora: string;
  estado: 'DESPACHADO' | 'EN_TRANSITO' | 'PENDIENTE';
}

export interface MermaCierre {
  id: string;
  insumo: string;
  cantidad: string;
  motivo: string;
  costoEstimado: number;
  registradoPor: string;
  hora: string;
}

export function mockDespachos(): DespachoLoteInsumo[] {
  return [
    { id: 'DSP-01', codigoLote: 'LOT-POL-2408', insumo: 'Pollos Frescos Eviscerados (Calibre 2.2kg)', cantidad: '30 unidades', solicitadoPor: 'Chef Mijael', hora: '14:30', estado: 'DESPACHADO' },
    { id: 'DSP-02', codigoLote: 'LOT-PAP-1102', insumo: 'Papa Amarilla Seleccionada para Fritura', cantidad: '50 kg', solicitadoPor: 'Chef Mijael', hora: '14:30', estado: 'DESPACHADO' },
    { id: 'DSP-03', codigoLote: 'LOT-CAR-0044', insumo: 'Carbón Vegetal de Algarrobo', cantidad: '3 sacos (75kg)', solicitadoPor: 'Chef Mijael', hora: '12:00', estado: 'DESPACHADO' }
  ];
}

export function mockMermas(): MermaCierre[] {
  return [
    { id: 'MRM-01', insumo: 'Papa Amarilla Cortada', cantidad: '2.5 kg', motivo: 'Oxidación por tiempo de corte', costoEstimado: 18.00, registradoPor: 'Chef Mijael', hora: '15:30' },
    { id: 'MRM-02', insumo: 'Pollo a la Brasa (1/2)', cantidad: '1/2 unidad', motivo: 'Cocción excesiva / piel sobrecalentada', costoEstimado: 32.00, registradoPor: 'Chef Mijael', hora: '16:00' },
    { id: 'MRM-03', insumo: 'Ensalada Fresca Preparada', cantidad: '3 porciones', motivo: 'No comercializada / cierre de turno almuerzo', costoEstimado: 12.00, registradoPor: 'Chef Mijael', hora: '16:15' }
  ];
}

/** MOCK: fabrica un despacho ficticio (codigo de lote aleatorio, sin llamada HTTP). */
export function mockNuevoDespacho(solicitadoPor: string): DespachoLoteInsumo {
  return {
    id: `DSP-${Date.now()}`,
    codigoLote: `LOT-POL-${Math.floor(1000 + Math.random() * 9000)}`,
    insumo: 'Pollos Frescos Eviscerados',
    cantidad: '20 unidades',
    solicitadoPor,
    hora: new Date().toLocaleTimeString().slice(0, 5),
    estado: 'DESPACHADO'
  };
}

/** MOCK: fabrica una merma ficticia (sin llamada HTTP). */
export function mockNuevaMerma(registradoPor: string): MermaCierre {
  return {
    id: `MRM-${Date.now()}`,
    insumo: 'Papa Amarilla Frita',
    cantidad: '1.5 kg',
    motivo: 'Merma por calibración de freidora',
    costoEstimado: 20.00,
    registradoPor,
    hora: new Date().toLocaleTimeString().slice(0, 5)
  };
}
