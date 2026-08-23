import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProductsService } from '../../../core/services/products.service';
import { CartService } from '../../../core/services/cart.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="bg-white min-h-screen font-sans selection:bg-polleria-gold selection:text-slate-900">
      
      <!-- ================= 1. HERO SECTION (FIGMA EXACT) ================= -->
      <section class="relative min-h-[520px] sm:min-h-[600px] lg:min-h-[660px] flex items-center justify-center overflow-hidden bg-black text-white">
        
        <!-- Background Atmospheric Restaurant Hero Image -->
        <img 
          src="/assets/images/hero-panoramic.jpg" 
          alt="Pollería San Pollo de Ica" 
          class="absolute inset-0 w-full h-full object-cover object-center scale-105"
        />

        <!-- Dark Gradient Overlays -->
        <div class="absolute inset-0 bg-gradient-to-t from-[#141618] via-black/40 to-black/70"></div>
        <div class="absolute inset-0 bg-radial-vignette opacity-70"></div>

        <!-- Ambient Heat Glow -->
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none"></div>

        <!-- Hero Content -->
        <div class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6 animate-slide-up">
          
          <!-- Slogan Principal Display -->
          <h1 class="font-display text-4xl sm:text-6xl lg:text-7xl tracking-wide uppercase text-white leading-tight drop-shadow-lg font-black">
            UNIENDO A LA <span class="text-polleria-gold drop-shadow-[0_2px_12px_rgba(245,158,11,0.5)]">FAMILIA</span> DESDE<br class="hidden sm:inline"/> EL PRIMER BOCADO
          </h1>

          <!-- Subtitle -->
          <p class="text-slate-200 text-xs sm:text-base font-normal max-w-2xl mx-auto leading-relaxed drop-shadow-md">
            Fuego, humo y el mejor pollo a la brasa de la ciudad. Descubre nuestro menú.
          </p>

          <!-- CTA Button -->
          <div class="pt-2">
            <button 
              type="button"
              (click)="scrollToSection('combos-section')"
              class="px-8 sm:px-10 py-3.5 sm:py-4 bg-polleria-gold hover:bg-amber-500 active:scale-95 text-slate-950 font-display text-lg sm:text-xl tracking-wider uppercase font-extrabold transition duration-200 shadow-xl shadow-black/60 rounded-xs cursor-pointer inline-flex items-center gap-2"
            >
              <span>VER PROMOCIONES</span>
              <svg class="w-4 h-4 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
          </div>

        </div>

      </section>


      <!-- ================= 2. CATEGORY ANCHOR SUB-NAVBAR ================= -->
      <nav class="sticky top-0 z-30 bg-[#24272c] border-y border-[#343840] shadow-md">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-start sm:justify-center gap-8 sm:gap-14 overflow-x-auto py-3.5 no-scrollbar">
          
          <button 
            type="button"
            (click)="scrollToSection('pollos-section')"
            class="font-display text-lg sm:text-xl tracking-wider text-polleria-gold hover:text-amber-400 transition cursor-pointer flex items-center gap-2"
          >
            <span>Pollo a la Brasa</span>
          </button>

          <button 
            type="button"
            (click)="scrollToSection('combos-section')"
            class="font-display text-lg sm:text-xl tracking-wider text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-2"
          >
            <span>Combos Familiares</span>
          </button>

          <button 
            type="button"
            (click)="scrollToSection('piqueos-section')"
            class="font-display text-lg sm:text-xl tracking-wider text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-2"
          >
            <span>Piqueos y Tragos</span>
          </button>

        </div>
      </nav>


      <!-- ================= 3. SECCIÓN: POLLO A LA BRASA (FIGMA EXACT) ================= -->
      <section id="pollos-section" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 space-y-10">
        
        <!-- Section Title with Flame -->
        <div class="flex items-center gap-3">
          <div class="text-polleria-crimson">
            <svg class="w-8 h-8 sm:w-10 sm:h-10 fill-current" viewBox="0 0 24 24">
              <path d="M12 23c-4.97 0-9-4.03-9-9 0-3.8 2.37-7.05 5.74-8.35.34-.13.71.05.81.39.1.34-.05.71-.39.81C6.27 7.97 4.5 10.78 4.5 14c0 4.14 3.36 7.5 7.5 7.5s7.5-3.36 7.5-7.5c0-2.48-1.07-4.73-2.91-6.19-.28-.22-.32-.62-.1-.9.22-.28.62-.32.9-.1C19.83 8.7 21 11.23 21 14c0 4.97-4.03 9-9 9z"/>
            </svg>
          </div>
          <h2 class="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-wide uppercase text-slate-950 leading-none">
            POLLO A LA BRASA
          </h2>
        </div>

        <!-- 3 Product Cards Grid (Figma Exact) -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          
          <!-- Card 1: Pollo Entero (Figma Exact) -->
          <div class="bg-[#16181b] rounded-2xl overflow-hidden border border-slate-800/90 shadow-xl flex flex-col justify-between group hover:-translate-y-1 transition duration-300">
            <div class="relative h-60 sm:h-64 overflow-hidden bg-slate-900">
              <img 
                src="/assets/images/hero-panoramic.jpg" 
                alt="Pollo Entero a la Brasa"
                class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
              />
              <div class="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#16181b] to-transparent"></div>
              <span class="absolute top-4 right-4 px-3.5 py-1 rounded-full bg-polleria-gold text-slate-950 text-[10px] font-black tracking-wider uppercase shadow-lg">
                MÁS PEDIDO
              </span>
            </div>

            <div class="p-6 pt-2 flex-1 flex flex-col justify-between space-y-4">
              <div class="space-y-2">
                <h3 class="font-display text-2xl sm:text-3xl text-white tracking-wide uppercase group-hover:text-polleria-gold transition">
                  Pollo Entero
                </h3>
                <p class="text-slate-400 text-xs sm:text-sm leading-relaxed">
                  1 Pollo a la brasa jugoso, porción familiar de papas fritas crujientes y ensalada fresca con vinagreta de la casa.
                </p>
              </div>

              <div class="pt-4 flex items-center justify-between border-t border-slate-800/80">
                <span class="font-display text-3xl sm:text-4xl font-bold text-polleria-gold">
                  S/ 65.00
                </span>
                <button 
                  (click)="quickAdd('prod-1')"
                  class="w-10 h-10 rounded-lg bg-polleria-crimson hover:bg-[#a81125] active:scale-90 text-white flex items-center justify-center transition cursor-pointer shadow-md"
                  title="Añadir"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Card 2: Medio Pollo (Figma Exact) -->
          <div class="bg-[#16181b] rounded-2xl overflow-hidden border border-slate-800/90 shadow-xl flex flex-col justify-between group hover:-translate-y-1 transition duration-300">
            <div class="relative h-60 sm:h-64 overflow-hidden bg-slate-900">
              <img 
                src="/assets/images/medio-pollo.jpg" 
                alt="Medio Pollo a la Brasa"
                class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
              />
              <div class="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#16181b] to-transparent"></div>
            </div>

            <div class="p-6 pt-2 flex-1 flex flex-col justify-between space-y-4">
              <div class="space-y-2">
                <h3 class="font-display text-2xl sm:text-3xl text-white tracking-wide uppercase group-hover:text-polleria-gold transition">
                  Medio Pollo
                </h3>
                <p class="text-slate-400 text-xs sm:text-sm leading-relaxed">
                  1/2 Pollo a la brasa, porción personal abundante de papas fritas y ensalada clásica.
                </p>
              </div>

              <div class="pt-4 flex items-center justify-between border-t border-slate-800/80">
                <span class="font-display text-3xl sm:text-4xl font-bold text-polleria-gold">
                  S/ 35.00
                </span>
                <button 
                  (click)="quickAdd('prod-2')"
                  class="w-10 h-10 rounded-lg bg-polleria-crimson hover:bg-[#a81125] active:scale-90 text-white flex items-center justify-center transition cursor-pointer shadow-md"
                  title="Añadir"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Card 3: 1/4 de Pollo (Figma Exact) -->
          <div class="bg-[#16181b] rounded-2xl overflow-hidden border border-slate-800/90 shadow-xl flex flex-col justify-between group hover:-translate-y-1 transition duration-300">
            <div class="relative h-60 sm:h-64 overflow-hidden bg-slate-900">
              <img 
                src="/assets/images/cuarto-pollo.jpg" 
                alt="1/4 de Pollo a la Brasa"
                class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
              />
              <div class="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#16181b] to-transparent"></div>
            </div>

            <div class="p-6 pt-2 flex-1 flex flex-col justify-between space-y-4">
              <div class="space-y-2">
                <h3 class="font-display text-2xl sm:text-3xl text-white tracking-wide uppercase group-hover:text-polleria-gold transition">
                  1/4 de Pollo
                </h3>
                <p class="text-slate-400 text-xs sm:text-sm leading-relaxed">
                  1/4 Pollo a la brasa (pecho o pierna), papas fritas y ensalada. Ideal para el antojo personal.
                </p>
              </div>

              <div class="pt-4 flex items-center justify-between border-t border-slate-800/80">
                <span class="font-display text-3xl sm:text-4xl font-bold text-polleria-gold">
                  S/ 20.00
                </span>
                <button 
                  (click)="quickAdd('prod-3')"
                  class="w-10 h-10 rounded-lg bg-polleria-crimson hover:bg-[#a81125] active:scale-90 text-white flex items-center justify-center transition cursor-pointer shadow-md"
                  title="Añadir"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

        </div>

      </section>


      <!-- ================= 4. SECCIÓN: COMBOS FAMILIARES (FIGMA EXACT CRIMSON BG) ================= -->
      <section id="combos-section" class="bg-[#7a0513] text-white py-16 sm:py-24 border-y border-black/20">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          <!-- Section Title & Subtitle (Figma Exact) -->
          <div class="flex items-start justify-between">
            <div class="space-y-1">
              <h2 class="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-wide uppercase text-white leading-none">
                COMBOS FAMILIARES
              </h2>
              <p class="text-white/80 text-xs sm:text-sm font-medium">
                Para compartir la intensidad.
              </p>
            </div>

            <!-- Group Icon -->
            <div class="text-white/70 hidden sm:block">
              <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
              </svg>
            </div>
          </div>

          <!-- Combos Cards Grid (Figma Exact) -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            <!-- COMBO 1: COMBO URBANO MÁXIMO (Featured Large Card - Figma Exact) -->
            <div class="lg:col-span-7 bg-[#16181b] rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col md:flex-row justify-between group hover:-translate-y-1 transition duration-300">
              
              <!-- Food Photo with Inka Kola & Salsas -->
              <div class="md:w-1/2 relative min-h-[260px] md:min-h-full overflow-hidden bg-slate-900">
                <img 
                  src="/assets/images/combo-urbano-maximo.jpg" 
                  alt="Combo Urbano Máximo"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              <!-- Content Side -->
              <div class="md:w-1/2 p-6 sm:p-8 flex flex-col justify-between space-y-4">
                
                <div class="space-y-2">
                  <span class="inline-block px-3.5 py-1 rounded-full bg-polleria-gold text-slate-950 text-[10px] font-black tracking-wider uppercase shadow-md">
                    OFERTA ESPECIAL
                  </span>

                  <h3 class="font-display text-3xl sm:text-4xl text-white tracking-wide uppercase font-black leading-tight pt-1">
                    Combo Urbano Máximo
                  </h3>

                  <p class="text-slate-300 text-xs sm:text-sm leading-relaxed">
                    1 Pollo entero + Porción extra grande de papas + Ensalada Familiar + Gaseosa 1.5L + 4 salsas de la casa.
                  </p>
                </div>

                <!-- Price and Button (Figma Exact) -->
                <div class="pt-4 border-t border-slate-800 space-y-4">
                  <div class="flex items-baseline gap-3">
                    <span class="font-display text-3xl sm:text-4xl font-black text-polleria-gold tracking-wide">
                      S/ 79.90
                    </span>
                    <span class="font-display text-lg sm:text-xl text-slate-500 line-through">
                      S/ 95.00
                    </span>
                  </div>

                  <button 
                    type="button"
                    (click)="quickAdd('prod-4')"
                    class="w-full py-3.5 px-6 rounded-xl bg-polleria-crimson hover:bg-[#a81125] active:scale-95 text-white font-display text-base tracking-wider uppercase font-bold transition duration-200 shadow-xl shadow-black/50 cursor-pointer text-center block"
                  >
                    AGREGAR AL CARRITO
                  </button>
                </div>

              </div>

            </div>

            <!-- COMBO 2: COMBO x1.5 (Figma Exact) -->
            <div class="lg:col-span-5 bg-[#16181b] rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col justify-between group hover:-translate-y-1 transition duration-300">
              
              <!-- Food Image -->
              <div class="relative h-64 overflow-hidden bg-slate-900">
                <img 
                  src="/assets/images/combo-uno-y-medio.jpg" 
                  alt="Combo x1.5 San Pollo"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              <!-- Content -->
              <div class="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-4">
                
                <div class="space-y-1.5">
                  <h3 class="font-display text-3xl text-white tracking-wide uppercase font-black">
                    Combo x1.5
                  </h3>
                  <p class="text-slate-300 text-xs sm:text-sm leading-relaxed">
                    1 1/2 Pollos + Papas Familiares + Ensalada Grande.
                  </p>
                </div>

                <!-- Price + Square Action Button (Figma Exact) -->
                <div class="pt-4 flex items-center justify-between border-t border-slate-800">
                  <span class="font-display text-3xl sm:text-4xl font-black text-polleria-gold">
                    S/ 95.00
                  </span>

                  <button 
                    type="button"
                    (click)="quickAdd('prod-5')"
                    class="w-11 h-11 rounded-xl border border-polleria-gold/70 hover:bg-polleria-gold hover:text-slate-950 text-polleria-gold flex items-center justify-center transition duration-200 cursor-pointer shadow-md"
                    title="Añadir al carrito"
                  >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
                    </svg>
                  </button>
                </div>

              </div>

            </div>

          </div>

        </div>
      </section>


      <!-- ================= 5. SECCIÓN: PIQUEOS & TRAGOS CRIOLLOS ================= -->
      <section id="piqueos-section" class="bg-[#121418] text-white py-16 sm:py-24">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          <div class="flex items-start justify-between">
            <div class="space-y-1">
              <h2 class="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-wide uppercase text-white leading-none">
                PIQUEOS & BEBIDAS
              </h2>
              <p class="text-slate-400 text-xs sm:text-sm">
                Entradas criollas a la leña y refrescos tradicionales.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            
            <!-- Piqueo 1: Tequeños Brasa -->
            <div class="bg-[#1a1c21] rounded-2xl overflow-hidden border border-white/5 shadow-xl flex flex-col justify-between group hover:-translate-y-1 transition">
              <div class="h-48 overflow-hidden bg-slate-900">
                <img 
                  src="https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&q=80" 
                  alt="Tequeños Rellenos de Pollo a la Brasa"
                  class="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
              </div>
              <div class="p-6 space-y-3">
                <h3 class="font-display text-2xl text-white uppercase">Tequeños Brasa (8 uds)</h3>
                <p class="text-slate-400 text-xs line-clamp-2">Rellenos de pollo a la brasa deshilachado con guacamole artesanal.</p>
                <div class="pt-2 flex justify-between items-center border-t border-white/5">
                  <span class="font-display text-2xl text-polleria-gold">S/ 22.00</span>
                  <button (click)="quickAdd('prod-6')" class="w-9 h-9 rounded-lg bg-polleria-crimson text-white flex items-center justify-center cursor-pointer hover:bg-[#a81125]">
                    +
                  </button>
                </div>
              </div>
            </div>

            <!-- Piqueo 2: Anticuchos Criollos -->
            <div class="bg-[#1a1c21] rounded-2xl overflow-hidden border border-white/5 shadow-xl flex flex-col justify-between group hover:-translate-y-1 transition">
              <div class="h-48 overflow-hidden bg-slate-900">
                <img 
                  src="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80" 
                  alt="Anticuchos de Corazón"
                  class="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
              </div>
              <div class="p-6 space-y-3">
                <h3 class="font-display text-2xl text-white uppercase">Anticuchos Criollos (2 palos)</h3>
                <p class="text-slate-400 text-xs line-clamp-2">Marinados en ají panca, vinagre y especias con papas doradas y choclo.</p>
                <div class="pt-2 flex justify-between items-center border-t border-white/5">
                  <span class="font-display text-2xl text-polleria-gold">S/ 26.00</span>
                  <button (click)="quickAdd('prod-7')" class="w-9 h-9 rounded-lg bg-polleria-crimson text-white flex items-center justify-center cursor-pointer hover:bg-[#a81125]">
                    +
                  </button>
                </div>
              </div>
            </div>

            <!-- Piqueo 3: Chicha Morada -->
            <div class="bg-[#1a1c21] rounded-2xl overflow-hidden border border-white/5 shadow-xl flex flex-col justify-between group hover:-translate-y-1 transition">
              <div class="h-48 overflow-hidden bg-slate-900">
                <img 
                  src="https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80" 
                  alt="Chicha Morada Artesanal"
                  class="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
              </div>
              <div class="p-6 space-y-3">
                <h3 class="font-display text-2xl text-white uppercase">Chicha Morada (1 Litro)</h3>
                <p class="text-slate-400 text-xs line-clamp-2">Maíz morado de valle hervido con piña, manzana, canela y clavo.</p>
                <div class="pt-2 flex justify-between items-center border-t border-white/5">
                  <span class="font-display text-2xl text-polleria-gold">S/ 14.00</span>
                  <button (click)="quickAdd('prod-8')" class="w-9 h-9 rounded-lg bg-polleria-crimson text-white flex items-center justify-center cursor-pointer hover:bg-[#a81125]">
                    +
                  </button>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

    </div>
  `
})
export class HomeComponent {
  private productsService = inject(ProductsService);
  private cart = inject(CartService);
  private notify = inject(NotificationService);

  quickAdd(productId: string): void {
    const product = this.productsService.products().find(p => p.id === productId);
    if (product) {
      this.cart.addItem(product, 1);
      this.notify.showSuccess(`+1 ${product.nombre} añadido al pedido`);
    }
  }

  scrollToSection(sectionId: string): void {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
