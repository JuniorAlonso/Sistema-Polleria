import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="sticky top-0 z-40 w-full bg-[#121316] border-b border-white/5 shadow-xl transition-all duration-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        
        <!-- Left: Brand Logo -->
        <a routerLink="/" class="flex items-center gap-2 group">
          <span class="font-display text-3xl sm:text-4xl tracking-wider font-black text-polleria-crimson group-hover:brightness-110 transition leading-none">
            SAN POLLO
          </span>
        </a>

        <!-- Center: Desktop Navigation Links -->
        <nav class="hidden md:flex items-center gap-8 text-sm font-medium">
          <a 
            routerLink="/" 
            routerLinkActive="text-white border-b-2 border-white pb-1 font-bold" 
            [routerLinkActiveOptions]="{exact: true}"
            class="text-slate-300 hover:text-white transition tracking-wide text-base font-semibold"
          >
            Menú
          </a>
          <a 
            routerLink="/menu" 
            routerLinkActive="text-white border-b-2 border-white pb-1 font-bold"
            class="text-slate-300 hover:text-white transition tracking-wide text-base font-semibold"
          >
            Promos
          </a>
          <a 
            routerLink="/tracking" 
            routerLinkActive="text-white border-b-2 border-white pb-1 font-bold"
            class="text-slate-300 hover:text-white transition tracking-wide text-base font-semibold"
          >
            Locales
          </a>
        </nav>

        <!-- Right: Actions -->
        <div class="flex items-center gap-4">
          
          <!-- Botón Rojo Carmesí: Pedir Ahora -->
          <a 
            routerLink="/checkout"
            class="px-5 py-2.5 bg-polleria-crimson hover:bg-[#a81125] text-white font-bold text-xs sm:text-sm tracking-wider uppercase transition duration-200 active:scale-95 shadow-md shadow-black/40 flex items-center justify-center cursor-pointer"
          >
            Pedir Ahora
          </a>

          <!-- Cart Icon with Badge -->
          <button 
            (click)="cart.toggleCartDrawer(true)"
            class="relative p-2 text-slate-300 hover:text-white transition cursor-pointer"
            title="Ver Carrito"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            
            @if (cart.totalItems() > 0) {
              <span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-polleria-crimson text-white text-[10px] font-black flex items-center justify-center border-2 border-[#121316]">
                {{ cart.totalItems() }}
              </span>
            }
          </button>

          <!-- User Profile Icon -->
          @if (!auth.isAuthenticated()) {
            <a 
              routerLink="/login"
              class="p-2 text-slate-300 hover:text-white transition cursor-pointer"
              title="Iniciar Sesión"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </a>
          } @else {
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-slate-300 hidden lg:inline">
                {{ auth.currentUser()?.nombre?.split(' ')?.at(0) }}
              </span>
              <button 
                (click)="auth.logout()"
                class="p-2 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                title="Cerrar sesión"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
              </button>
            </div>
          }

        </div>
      </div>
    </header>
  `
})
export class NavbarComponent {
  readonly cart = inject(CartService);
  readonly auth = inject(AuthService);
}
