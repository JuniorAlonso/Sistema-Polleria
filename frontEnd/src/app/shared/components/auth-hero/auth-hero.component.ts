import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-auth-hero',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="w-full h-full relative min-h-[380px] lg:min-h-screen overflow-hidden flex flex-col justify-between p-8 sm:p-12 lg:p-16">
      
      <!-- Background Hero Image -->
      <img 
        src="/assets/images/login-hero.jpg" 
        alt="Pollo a la Brasa San Pollo de Ica" 
        class="absolute inset-0 w-full h-full object-cover object-center scale-105"
      />

      <!-- Multi-layer Gradient Overlay for High Readability -->
      <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/80 lg:bg-gradient-to-r lg:from-black/70 lg:to-polleria-dark"></div>

      <!-- Brand Titles Header (Figma Exact) -->
      <div class="relative z-10 space-y-2">
        <div class="inline-block">
          <h1 class="font-display text-4xl sm:text-5xl lg:text-6xl text-white tracking-wide uppercase leading-none drop-shadow-md">
            POLLERÍA
          </h1>
          <h2 class="font-display text-4xl sm:text-5xl lg:text-6xl text-polleria-gold tracking-wide uppercase leading-none drop-shadow-md">
            SAN POLLO<br/>DE ICA
          </h2>
        </div>

        <p class="text-slate-200 text-sm sm:text-base font-normal max-w-sm leading-relaxed drop-shadow-sm pt-2">
          El verdadero sabor de la calle. Fuego, brasa y actitud en cada pedido.
        </p>
      </div>

      <!-- Back to Home Link -->
      <div class="relative z-10 pt-8 lg:pt-0">
        <a 
          routerLink="/" 
          class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/20 text-xs font-semibold text-slate-300 hover:text-white transition duration-200"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          <span>Volver a la Carta Digital</span>
        </a>
      </div>

    </div>
  `
})
export class AuthHeroComponent {}
