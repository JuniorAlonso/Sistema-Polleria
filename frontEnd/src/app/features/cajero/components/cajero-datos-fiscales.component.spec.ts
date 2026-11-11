import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CajeroDatosFiscalesComponent } from './cajero-datos-fiscales.component';
import { DatosFiscales, consumidorFinal } from '../models/datos-fiscales';

@Component({
  standalone: true,
  imports: [CajeroDatosFiscalesComponent],
  template: `<app-cajero-datos-fiscales [(datos)]="datos" [total]="total()" />`
})
class AnfitrionComponent {
  readonly datos = signal<DatosFiscales>(consumidorFinal());
  readonly total = signal(50);
}

describe('CajeroDatosFiscalesComponent', () => {
  let fixture: ComponentFixture<AnfitrionComponent>;
  let anfitrion: AnfitrionComponent;
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (id: string) => el().querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

  beforeEach(() => {
    fixture = TestBed.createComponent(AnfitrionComponent);
    anfitrion = fixture.componentInstance;
    fixture.detectChanges();
  });

  function escribir(id: string, valor: string) {
    const input = q(id) as HTMLInputElement;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('consumidor final no pide documento', () => {
    expect(q('fiscal-numero')).toBeNull();
    expect(q('fiscal-motivo')).toBeNull();
  });

  it('factura pide RUC y razón social y avisa mientras el RUC está incompleto', () => {
    q('fiscal-RUC')!.click();
    fixture.detectChanges();

    escribir('fiscal-numero', '2012');
    escribir('fiscal-nombre', 'ACME SAC');
    expect(q('fiscal-motivo')?.textContent).toContain('11 dígitos');

    escribir('fiscal-numero', '20123456789');
    expect(q('fiscal-motivo')).toBeNull();
    expect(anfitrion.datos()).toEqual(jasmine.objectContaining({ tipo: 'FACTURA', tipoDoc: 'RUC', numDoc: '20123456789', nombre: 'ACME SAC' }));
  });

  it('sobre S/ 700 el consumidor final muestra que hace falta el DNI', () => {
    anfitrion.total.set(800);
    fixture.detectChanges();

    expect(q('fiscal-motivo')?.textContent).toContain('DNI');
  });
});
