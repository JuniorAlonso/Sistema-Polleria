import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="bg-[#141618] font-sans selection:bg-polleria-gold selection:text-slate-900">
      
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
            
            <a 
              routerLink="/menu"
              class="px-8 sm:px-10 py-3.5 sm:py-4 bg-polleria-gold hover:bg-amber-500 active:scale-95 text-slate-950 font-display text-lg sm:text-xl tracking-wider uppercase font-extrabold transition duration-200 shadow-xl shadow-black/60 rounded-xs cursor-pointer inline-flex items-center gap-2"
            >
              <span>VER PROMOCIONES</span>
              <svg class="w-4 h-4 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/>
              </svg>
            </a>
          </div>

        </div>

      </section>

    </div>
  `
})
export class HomeComponent {}
