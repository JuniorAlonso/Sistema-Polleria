export type KitchenTab = 'KDS';
export type KdsFilter = 'TODAS' | 'POR_PREPARAR' | 'EN_PREPARACION' | 'LISTOS';

export function codigoNumerico(code: string): string {
  return code ? code.replace('POL-', '') : '1001';
}
