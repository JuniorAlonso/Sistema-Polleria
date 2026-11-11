import { consumidorFinal, motivoDatosFiscalesInvalidos } from './datos-fiscales';

describe('datos fiscales (D3.8)', () => {
  it('consumidor final hasta S/ 700 es válido', () => {
    expect(motivoDatosFiscalesInvalidos(consumidorFinal(), 700)).toBeNull();
  });

  it('consumidor final sobre S/ 700 exige DNI', () => {
    expect(motivoDatosFiscalesInvalidos(consumidorFinal(), 700.01)).toContain('DNI');
  });

  it('boleta con DNI real sobre S/ 700 es válida; un DNI de ceros no', () => {
    expect(motivoDatosFiscalesInvalidos({ tipo: 'BOLETA', tipoDoc: 'DNI', numDoc: '72345678', nombre: 'Ana' }, 900)).toBeNull();
    expect(motivoDatosFiscalesInvalidos({ tipo: 'BOLETA', tipoDoc: 'DNI', numDoc: '00000000', nombre: 'Ana' }, 900)).toContain('DNI');
  });

  it('un DNI que no tiene 8 dígitos es inválido aunque el total sea bajo', () => {
    expect(motivoDatosFiscalesInvalidos({ tipo: 'BOLETA', tipoDoc: 'DNI', numDoc: '1234', nombre: 'Ana' }, 20)).toContain('8 dígitos');
  });

  it('una boleta con DNI exige el nombre del comprador', () => {
    expect(motivoDatosFiscalesInvalidos({ tipo: 'BOLETA', tipoDoc: 'DNI', numDoc: '72345678', nombre: '' }, 20)).toContain('nombre');
  });

  it('factura exige RUC de 11 dígitos y razón social', () => {
    expect(motivoDatosFiscalesInvalidos({ tipo: 'FACTURA', tipoDoc: 'RUC', numDoc: '2012345678', nombre: 'ACME' }, 20)).toContain('11 dígitos');
    expect(motivoDatosFiscalesInvalidos({ tipo: 'FACTURA', tipoDoc: 'RUC', numDoc: '20123456789', nombre: ' ' }, 20)).toContain('razón social');
    expect(motivoDatosFiscalesInvalidos({ tipo: 'FACTURA', tipoDoc: 'RUC', numDoc: '20123456789', nombre: 'ACME SAC' }, 20)).toBeNull();
  });
});
