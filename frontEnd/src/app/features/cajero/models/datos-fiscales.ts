/**
 * Tax data of a sale receipt (D3.8). Shared by the POS charge and Plan 2's pickup/counter flows.
 * The backend enforces the same rules; this copy only lets the cashier fix them before charging.
 */
export interface DatosFiscales {
  tipo: 'BOLETA' | 'FACTURA';
  tipoDoc?: 'DNI' | 'RUC';
  numDoc?: string;
  /** Buyer name, or company name for a factura. */
  nombre: string;
  direccion?: string;
}

export const TOPE_CONSUMIDOR_FINAL = 700;

export function consumidorFinal(): DatosFiscales {
  return { tipo: 'BOLETA', nombre: 'Cliente General' };
}

/** Why the data cannot be used for this total, or `null` when it is valid. */
export function motivoDatosFiscalesInvalidos(datos: DatosFiscales, total: number): string | null {
  const numero = (datos.numDoc || '').trim();

  if (datos.tipo === 'FACTURA') {
    if (!/^\d{11}$/.test(numero)) return 'La factura exige un RUC de 11 dígitos.';
    if (!datos.nombre?.trim()) return 'La factura exige la razón social.';
    return null;
  }

  if (!datos.nombre?.trim()) return 'Ingresa el nombre del comprador.';
  if (numero && !/^\d{8}$/.test(numero)) return 'El DNI debe tener 8 dígitos.';
  if (total > TOPE_CONSUMIDOR_FINAL && (!numero || /^0{8}$/.test(numero))) {
    return `Una boleta de más de S/ ${TOPE_CONSUMIDOR_FINAL} exige el DNI real del comprador.`;
  }
  return null;
}
