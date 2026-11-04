import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IncidenteForm } from '../../models/admin-forms';

/** Modal para documentar un incidente. Presentacional: edita un borrador local y lo emite. */
@Component({
  selector: 'app-incident-create-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-lg bg-slate-900 border border-polleria-crimson/50 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-white">Documentar Incidente Operativo (RF34)</h3>
              <button (click)="closed.emit()" class="text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div class="space-y-3 text-xs">
              <div>
                <label class="block font-bold text-slate-300 mb-1">Título del Incidente:</label>
                <input 
                  type="text" 
                  [(ngModel)]="draft.titulo"
                  placeholder="Ej. Falla en sincronización de comanda de mesa 4"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Módulo Afectado:</label>
                  <select 
                    [(ngModel)]="draft.modulo"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  >
                    <option value="COCINA_HORNO">Cocina & Hornos</option>
                    <option value="PAGOS">Pagos & Pasarelas</option>
                    <option value="RED_WIFI">Red & Conectividad</option>
                    <option value="SISTEMA_LOCAL">Sistema Local / Terminal</option>
                  </select>
                </div>
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Severidad:</label>
                  <select 
                    [(ngModel)]="draft.severidad"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  >
                    <option value="BAJA">Baja</option>
                    <option value="MEDIA">Media</option>
                    <option value="ALTA">Alta (Crítica)</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-300 mb-1">Causa Raíz:</label>
                <textarea 
                  [(ngModel)]="draft.causaRaiz"
                  rows="2"
                  placeholder="Explicación técnica o procedimental de la causa..."
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                ></textarea>
              </div>

              <div>
                <label class="block font-bold text-slate-300 mb-1">Solución Aplicada / Acción Correctiva:</label>
                <textarea 
                  [(ngModel)]="draft.solucionAplicada"
                  rows="2"
                  placeholder="Acción tomada para solucionar y prevenir recurrencia..."
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                ></textarea>
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button (click)="closed.emit()" class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer">Cancelar</button>
              <button (click)="confirmed.emit(draft)" class="px-5 py-2 rounded-xl bg-polleria-crimson hover:bg-polleria-crimsonHover text-white text-xs font-bold uppercase cursor-pointer">Registrar en Auditoría</button>
            </div>
          </div>
        </div>
  `
})
export class IncidentCreateModalComponent implements OnInit {
  readonly initial = input.required<IncidenteForm>();

  readonly closed = output<void>();
  readonly confirmed = output<IncidenteForm>();

  protected draft!: IncidenteForm;

  ngOnInit(): void {
    this.draft = { ...this.initial() };
  }
}
