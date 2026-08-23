import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthHeroComponent } from '../../../shared/components/auth-hero/auth-hero.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AuthHeroComponent],
  template: `
    <div class="min-h-screen w-full flex flex-col lg:flex-row bg-polleria-dark font-sans text-slate-100 selection:bg-polleria-gold selection:text-slate-900">
      
      <!-- ================= LEFT HERO PANEL (MODULAR) ================= -->
      <div class="lg:w-1/2">
        <app-auth-hero />
      </div>

      <!-- ================= RIGHT FORM PANEL (REGISTRO) ================= -->
      <div class="lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16 bg-polleria-dark relative z-10">
        <div class="w-full max-w-md space-y-7 animate-slide-up">
          
          <!-- Title & Yellow Accent Line -->
          <div class="space-y-2">
            <div>
              <h2 class="font-display text-4xl sm:text-5xl tracking-wide uppercase text-white">
                REGISTRO
              </h2>
              <div class="w-16 h-1 bg-polleria-gold mt-1 rounded-full"></div>
            </div>

            <p class="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Completa tus datos para crear tu cuenta y empezar a realizar pedidos.
            </p>
          </div>

          <!-- Register Form -->
          <form (ngSubmit)="handleRegister()" class="space-y-4">
            
            <!-- Campo: Nombre Completo (RF01) -->
            <div class="space-y-1.5">
              <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                NOMBRE COMPLETO
              </label>
              <div class="relative flex items-center">
                <span class="absolute left-3.5 text-slate-500">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                </span>
                <input 
                  type="text" 
                  [(ngModel)]="nombre" 
                  name="nombre"
                  placeholder="Tu nombre y apellido"
                  class="w-full pl-10 pr-4 py-3 bg-white text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-polleria-gold transition rounded-xs"
                  required
                />
              </div>
            </div>

            <!-- Campo: Celular (RF01) -->
            <div class="space-y-1.5">
              <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                NÚMERO DE CELULAR (WHATSAPP)
              </label>
              <div class="relative flex items-center">
                <span class="absolute left-3.5 text-slate-500">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                  </svg>
                </span>
                <input 
                  type="tel" 
                  [(ngModel)]="celular" 
                  name="celular"
                  placeholder="Ej. 987654321"
                  class="w-full pl-10 pr-4 py-3 bg-white text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-polleria-gold transition rounded-xs"
                  required
                />
              </div>
            </div>

            <!-- Campo: Correo Electrónico (RF01) -->
            <div class="space-y-1.5">
              <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                CORREO ELECTRÓNICO
              </label>
              <div class="relative flex items-center">
                <span class="absolute left-3.5 text-slate-500">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                </span>
                <input 
                  type="email" 
                  [(ngModel)]="correo" 
                  name="correo"
                  placeholder="tu@email.com"
                  class="w-full pl-10 pr-4 py-3 bg-white text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-polleria-gold transition rounded-xs"
                  required
                />
              </div>
            </div>

            <!-- Campo: Contraseña (RF01) -->
            <div class="space-y-1.5">
              <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                CONTRASEÑA
              </label>
              <div class="relative flex items-center">
                <span class="absolute left-3.5 text-slate-500">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                </span>
                <input 
                  type="password" 
                  [(ngModel)]="password" 
                  name="password"
                  placeholder="Mínimo 6 caracteres"
                  class="w-full pl-10 pr-4 py-3 bg-white text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-polleria-gold transition rounded-xs"
                  required
                />
              </div>
            </div>

            <!-- Botón Principal Crimson Red -->
            <div class="pt-2">
              <button 
                type="submit" 
                [disabled]="auth.isLoading()"
                class="w-full py-4 bg-polleria-crimson hover:bg-polleria-crimsonHover active:scale-[0.99] text-white font-display text-xl tracking-wider uppercase transition duration-200 flex items-center justify-center gap-2 shadow-lg shadow-black/50 disabled:opacity-50 cursor-pointer rounded-xs"
              >
                @if (auth.isLoading()) {
                  <span>REGISTRANDO...</span>
                } @else {
                  <span>REGISTRARME</span>
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                  </svg>
                }
              </button>
            </div>

            <!-- Divider con 'o' -->
            <div class="relative flex items-center justify-center py-2">
              <div class="w-full border-t border-slate-800"></div>
              <span class="absolute px-3 bg-polleria-dark text-slate-500 text-xs font-serif italic">
                o
              </span>
            </div>

            <!-- Botón Secundario Dorado: Enlace a Login -->
            <a 
              routerLink="/login"
              class="w-full py-4 bg-transparent border-2 border-polleria-gold hover:bg-polleria-gold/10 active:scale-[0.99] text-polleria-gold font-display text-xl tracking-wider uppercase transition duration-200 block text-center cursor-pointer rounded-xs"
            >
              YA TENGO CUENTA
            </a>

          </form>

        </div>
      </div>

    </div>
  `
})
export class RegisterComponent {
  readonly auth = inject(AuthService);
  private router = inject(Router);
  private notify = inject(NotificationService);

  nombre = '';
  celular = '';
  correo = '';
  password = '';

  handleRegister(): void {
    if (!this.nombre || !this.celular || !this.correo || !this.password) {
      this.notify.showError('Por favor completa todos los campos para tu registro');
      return;
    }

    this.auth.register({
      nombre: this.nombre,
      celular: this.celular,
      correo: this.correo,
      password: this.password
    }).subscribe({
      next: () => {
        this.notify.showSuccess(`¡Bienvenido/a, ${this.nombre}!`, 'Tu cuenta ha sido creada exitosamente.');
        this.router.navigate(['/menu']);
      },
      error: () => {
        this.notify.showError('Error al crear la cuenta');
      }
    });
  }
}
