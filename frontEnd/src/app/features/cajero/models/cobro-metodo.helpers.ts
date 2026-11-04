export function formatearMetodoCobro(metodo: any): string {
  if (!metodo) return 'Efectivo';
  const m = String(metodo).toUpperCase();
  if (m.includes('EFECTIVO') || m.includes('CONTRAENTREGA')) return 'Efectivo';
  if (m.includes('TARJETA') || m.includes('POS')) return 'Tarjeta POS';
  if (m.includes('YAPE') || m.includes('PLIN')) return 'Yape / Plin';
  return String(metodo);
}

export function claseMetodoCobro(metodo: any): string {
  if (!metodo) return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
  const m = String(metodo).toUpperCase();
  if (m.includes('EFECTIVO') || m.includes('CONTRAENTREGA')) {
    return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
  }
  if (m.includes('TARJETA') || m.includes('POS')) {
    return 'bg-sky-500/20 text-sky-300 border border-sky-500/30';
  }
  return 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
}
