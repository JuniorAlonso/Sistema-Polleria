import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <footer class="bg-[#0f1013] text-slate-400 text-xs border-t border-white/10 mt-auto font-sans selection:bg-polleria-gold selection:text-slate-900">
      
      <!-- Top Section: Main columns -->
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 sm:gap-10">
        
        <!-- Col 1: Brand & Razón Social (SUNAT / INDECOPI) -->
        <div class="lg:col-span-2 space-y-4">
          <div class="flex items-center gap-2">
            <span class="font-display text-3xl text-polleria-crimson font-black tracking-wider">
              SAN POLLO
            </span>
            <span class="font-display text-3xl text-polleria-gold font-black tracking-wider">
              DE ICA
            </span>
          </div>

          <p class="text-slate-300 text-xs leading-relaxed max-w-sm">
            El verdadero sabor a la brasa criolla con leña de algarrobo. Fuego, humo y tradición en cada pedido.
          </p>

          <!-- Datos Fiscales SUNAT (Requerimiento Ley Peruana) -->
          <div class="p-3.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-300 space-y-1">
            <p><strong class="text-white">Razón Social:</strong> SAN POLLO GASTRONOMÍA S.A.C.</p>
            <p><strong class="text-white">RUC:</strong> 20608945123</p>
            <p><strong class="text-white">Sede Central:</strong> Av. Los Maestros 450, Ica, Perú</p>
            <p><strong class="text-white">Sucursal Lima:</strong> Av. Benavides 1240, Miraflores, Lima</p>
          </div>
        </div>

        <!-- Col 2: Enlaces Rápidos & Carta -->
        <div class="space-y-3">
          <h4 class="font-bold text-sm text-white uppercase tracking-wider">Nuestra Carta</h4>
          <ul class="space-y-2 text-slate-400">
            <li><a routerLink="/" fragment="pollos" class="hover:text-polleria-gold transition">Pollo a la Brasa</a></li>
            <li><a routerLink="/" fragment="combos" class="hover:text-polleria-gold transition">Combos Familiares</a></li>
            <li><a routerLink="/" fragment="piqueos" class="hover:text-polleria-gold transition">Piqueos & Tragos</a></li>
            <li><a routerLink="/menu" class="hover:text-polleria-gold transition">Carta Completa</a></li>
            <li><a routerLink="/tracking" class="hover:text-polleria-gold transition">Rastreo de Pedido</a></li>
          </ul>
        </div>

        <!-- Col 3: Marco Legal & Políticas (Leyes Peruanas) -->
        <div class="space-y-3">
          <h4 class="font-bold text-sm text-white uppercase tracking-wider">Políticas & Legal</h4>
          <ul class="space-y-2 text-slate-400">
            <li>
              <a href="javascript:void(0)" (click)="openLegalModal('terminos')" class="hover:text-polleria-gold transition">
                Términos y Condiciones
              </a>
            </li>
            <li>
              <a href="javascript:void(0)" (click)="openLegalModal('privacidad')" class="hover:text-polleria-gold transition">
                Política de Privacidad (Ley N° 29733)
              </a>
            </li>
            <li>
              <a href="javascript:void(0)" (click)="openLegalModal('delivery')" class="hover:text-polleria-gold transition">
                Políticas de Delivery y Despacho
              </a>
            </li>
            <li>
              <a href="javascript:void(0)" (click)="openLegalModal('comprobantes')" class="hover:text-polleria-gold transition">
                Comprobantes Electrónicos SUNAT
              </a>
            </li>
            <li>
              <a href="javascript:void(0)" (click)="openLegalModal('devoluciones')" class="hover:text-polleria-gold transition">
                Cambios y Cancelaciones (INDECOPI)
              </a>
            </li>
          </ul>
        </div>

        <!-- Col 4: Libro de Reclamaciones INDECOPI (Obligatorio Ley N° 29571) -->
        <div class="space-y-4">
          <h4 class="font-bold text-sm text-white uppercase tracking-wider">Atención al Cliente</h4>

          <!-- Libro de Reclamaciones Virtual Badge -->
          <button 
            type="button"
            (click)="openLibroModal()"
            class="w-full p-3.5 rounded-2xl bg-[#1c1f24] hover:bg-[#252930] border border-white/15 transition duration-200 text-left flex items-center gap-3 cursor-pointer shadow-lg group"
          >
            <div class="w-10 h-10 rounded-xl bg-white text-slate-900 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <svg class="w-5 h-5 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              </svg>
            </div>
            <div>
              <span class="block font-bold text-white text-xs leading-snug">
                Libro de Reclamaciones
              </span>
              <span class="text-[10px] text-slate-400">
                Conforme al Código de INDECOPI
              </span>
            </div>
          </button>

          <!-- Contact info with SVG icons -->
          <div class="space-y-2 text-[11px] text-slate-300">
            <p class="flex items-center gap-2">
              <svg class="w-3.5 h-3.5 text-polleria-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
              </svg>
              <span>Central: (01) 789-4560</span>
            </p>
            <p class="flex items-center gap-2">
              <svg class="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
              <span>WhatsApp: +51 987 654 321</span>
            </p>
            <p class="flex items-center gap-2">
              <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              <span>atencionalcliente&#64;sanpollo.pe</span>
            </p>
          </div>

        </div>

      </div>


      <!-- Mid Section: Medios de Pago & Sellos de Seguridad -->
      <div class="border-t border-white/10 bg-black/40 py-6">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          
          <!-- Payment methods badges -->
          <div class="flex flex-wrap items-center justify-center gap-2">
            <span class="text-[11px] text-slate-400 font-bold uppercase mr-2">Pagos Aceptados:</span>
            <span class="px-2.5 py-1 rounded bg-white/10 font-mono text-[10px] text-white font-bold">VISA</span>
            <span class="px-2.5 py-1 rounded bg-white/10 font-mono text-[10px] text-white font-bold">MASTERCARD</span>
            <span class="px-2.5 py-1 rounded bg-purple-900/60 border border-purple-500/40 font-mono text-[10px] text-purple-300 font-bold">YAPE</span>
            <span class="px-2.5 py-1 rounded bg-cyan-900/60 border border-cyan-500/40 font-mono text-[10px] text-cyan-300 font-bold">PLIN</span>
            <span class="px-2.5 py-1 rounded bg-emerald-900/60 border border-emerald-500/40 font-mono text-[10px] text-emerald-300 font-bold">EFECTIVO</span>
          </div>

          <!-- Security certification -->
          <div class="flex items-center gap-2 text-[11px] text-slate-400">
            <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
            <span class="text-emerald-400 font-bold">SSL Seguro 256-bit</span>
            <span>• Transacciones protegidas</span>
          </div>

        </div>
      </div>


      <!-- Bottom Section: Advertencia Legal de Alcohol (Ley N° 28681) & Copyright -->
      <div class="border-t border-white/5 bg-[#0a0b0d] py-6 text-center space-y-2">
        <p class="text-[10px] text-slate-400 uppercase tracking-widest font-bold max-w-2xl mx-auto">
          TOMAR BEBIDAS ALCOHÓLICAS EN EXCESO ES DAÑINO. PROHIBIDA LA VENTA DE BEBIDAS ALCOHÓLICAS A MENORES DE 18 AÑOS (LEY N° 28681).
        </p>
        <p class="text-[11px] text-slate-500">
          © 2026 SAN POLLO GASTRONOMÍA S.A.C. - RUC 20608945123. Todos los derechos reservados.
        </p>
      </div>


      <!-- ================= MODAL LIBRO DE RECLAMACIONES VIRTUAL (INDECOPI) ================= -->
      @if (showLibroModal()) {
        <div class="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in text-slate-900">
          <div class="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto">
            
            <div class="flex items-center justify-between pb-4 border-b border-slate-200">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                  </svg>
                </div>
                <div>
                  <h3 class="font-bold text-lg text-slate-900 leading-tight">
                    Libro de Reclamaciones Virtual
                  </h3>
                  <p class="text-xs text-slate-500">
                    SAN POLLO GASTRONOMÍA S.A.C. • RUC: 20608945123
                  </p>
                </div>
              </div>

              <button 
                (click)="showLibroModal.set(false)"
                class="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form (submit)="enviarReclamo($event)" class="space-y-4 text-xs">
              
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Nombre Completo *</label>
                  <input type="text" required placeholder="Nombres y Apellidos" class="w-full px-3 py-2 border rounded-xl bg-slate-50 text-xs" />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Tipo y N° Documento (DNI/CE) *</label>
                  <input type="text" required placeholder="DNI o Carnet de Extranjería" class="w-full px-3 py-2 border rounded-xl bg-slate-50 text-xs" />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Correo Electrónico *</label>
                  <input type="email" required placeholder="tu@email.com" class="w-full px-3 py-2 border rounded-xl bg-slate-50 text-xs" />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Teléfono / Celular *</label>
                  <input type="tel" required placeholder="Ej. 987654321" class="w-full px-3 py-2 border rounded-xl bg-slate-50 text-xs" />
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Tipo de Solicitud *</label>
                <div class="flex gap-4 pt-1">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="tipo" value="QUEJA" checked />
                    <span><strong>Queja</strong> (Malestar respecto a la atención)</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="tipo" value="RECLAMO" />
                    <span><strong>Reclamo</strong> (Disconformidad relacionada a los productos/comida)</span>
                  </label>
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Detalle y Motivo de la Queja o Reclamo *</label>
                <textarea rows="4" required placeholder="Describe los hechos ocurridos, número de pedido o fecha..." class="w-full px-3 py-2 border rounded-xl bg-slate-50 text-xs"></textarea>
              </div>

              <p class="text-[11px] text-slate-500 leading-relaxed">
                * Conforme a lo establecido en el Código de Protección y Defensa del Consumidor, la empresa dará respuesta en un plazo no mayor a quince (15) días hábiles improrrogables.
              </p>

              <div class="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  (click)="showLibroModal.set(false)"
                  class="px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  class="px-6 py-2.5 rounded-xl bg-polleria-crimson text-white font-bold cursor-pointer hover:bg-[#a81125]"
                >
                  Enviar Reclamación
                </button>
              </div>

            </form>

          </div>
        </div>
      }

    </footer>
  `
})
export class FooterComponent {
  readonly showLibroModal = signal<boolean>(false);

  openLibroModal(): void {
    this.showLibroModal.set(true);
  }

  openLegalModal(type: string): void {
    alert(`Políticas y Términos de San Pollo (${type.toUpperCase()}):\n\nConforme a las leyes peruanas Ley N° 29571 y Ley N° 29733, todos los datos personales son procesados para fines de facturación y despacho.`);
  }

  enviarReclamo(event: Event): void {
    event.preventDefault();
    alert('Hoja de reclamación registrada exitosamente. Se ha enviado una copia con número de reclamo a tu correo conforme a ley.');
    this.showLibroModal.set(false);
  }
}
