import { Component } from '@angular/core';
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

        <!-- Col 4: Atención al Cliente -->
        <div class="space-y-4">
          <h4 class="font-bold text-sm text-white uppercase tracking-wider">Atención al Cliente</h4>

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




      <!-- Bottom Section: Advertencia Legal de Alcohol (Ley N° 28681) & Copyright -->
      <div class="border-t border-white/5 bg-[#0a0b0d] py-6 text-center space-y-2">
        <p class="text-[10px] text-slate-400 uppercase tracking-widest font-bold max-w-2xl mx-auto">
          TOMAR BEBIDAS ALCOHÓLICAS EN EXCESO ES DAÑINO. PROHIBIDA LA VENTA DE BEBIDAS ALCOHÓLICAS A MENORES DE 18 AÑOS (LEY N° 28681).
        </p>
        <p class="text-[11px] text-slate-500">
          © 2026 SAN POLLO GASTRONOMÍA S.A.C. - RUC 20608945123. Todos los derechos reservados.
        </p>
      </div>


    </footer>
  `
})
export class FooterComponent {
  openLegalModal(type: string): void {
    alert(`Políticas y Términos de San Pollo (${type.toUpperCase()}):\n\nConforme a las leyes peruanas Ley N° 29571 y Ley N° 29733, todos los datos personales son procesados para fines de facturación y despacho.`);
  }
}
