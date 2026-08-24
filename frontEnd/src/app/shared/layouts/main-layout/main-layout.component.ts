import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { CartDrawerComponent } from '../../components/cart-drawer/cart-drawer.component';
import { FooterComponent } from '../../components/footer/footer.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, CartDrawerComponent, FooterComponent],
  template: `
    <div class="min-h-screen flex flex-col bg-white font-sans text-slate-900 selection:bg-polleria-gold selection:text-slate-900">
      
      <!-- Main Navigation -->
      <app-navbar />

      <!-- Page Content -->
      <main class="flex-1">
        <router-outlet />
      </main>

      <!-- Reactive Cart Slide-over Drawer -->
      <app-cart-drawer />

      <!-- Modular Footer -->
      <app-footer />

    </div>
  `
})
export class MainLayoutComponent {}
