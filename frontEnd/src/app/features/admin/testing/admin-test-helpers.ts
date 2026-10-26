import { MesaSalon } from '../../../core/models/table.model';

/** Token de 3 partes: los servicios solo comprueban que exista para habilitar /mesas. */
export function tokenDeSesion(): string {
  const b64 = btoa(JSON.stringify({ userId: 7 }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `cabecera.${b64}.firma-falsa`;
}

export const productoDto = {
  id: 1,
  nombre: 'Pollo a la Brasa Entero',
  descripcion: '',
  precio: 65,
  categoria: 'POLLO_ENTERO',
  imagenUrl: '',
  disponible: true
};

export function mesa(over: Partial<MesaSalon> = {}): MesaSalon {
  return {
    id: 3,
    numero: 3,
    capacidad: 4,
    estado: 'LIBRE',
    posicionX: 1,
    posicionY: 1,
    zona: 'SALON_PRINCIPAL',
    ...over
  };
}

export function mesaConComanda(estadoComanda = 'LISTO', servidoEn: string | null = null): MesaSalon {
  return mesa({
    estado: 'OCUPADA',
    ordenActiva: {
      ordenId: 7,
      mozoId: 7,
      total: 45.5,
      estadoOrden: estadoComanda,
      tiempoEsperaMinutos: 5,
      servidoEn
    }
  });
}

export function dtoOrden(over: { id?: number; estado?: string; total?: number } = {}) {
  return {
    id: over.id ?? 7,
    tipo: 'SALON',
    estado: over.estado ?? 'RECIBIDO',
    total: over.total ?? 65,
    mesaNumero: 3,
    nombreCliente: 'Mesa 03',
    telefonoCliente: '',
    items: [],
    creadoEn: '2026-01-01T00:00:00Z'
  };
}
