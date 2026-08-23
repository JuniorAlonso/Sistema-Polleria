import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthHeroComponent } from '../../../shared/components/auth-hero/auth-hero.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AuthHeroComponent],
  template: `
    <div class="min-h-screen w-full flex flex-col lg:flex-row bg-polleria-dark font-sans text-slate-100 selection:bg-polleria-gold selection:text-slate-900">
      
      <!-- ================= LEFT HERO PANEL (MODULAR) ================= -->
      <div class="lg:w-1/2">
        <app-auth-hero />
      </div>

      <!-- ================= RIGHT FORM PANEL (ACCESO) ================= -->
      <div class="lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16 bg-polleria-dark relative z-10">
        <div class="w-full max-w-md space-y-8 animate-slide-up">
          
          <!-- Title & Yellow Accent Line -->
          <div class="space-y-3">
            <div>
              <h2 class="font-display text-4xl sm:text-5xl tracking-wide uppercase text-white">
                ACCESO
              </h2>
              <div class="w-16 h-1 bg-polleria-gold mt-1 rounded-full"></div>
            </div>

            <p class="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Ingresa tus datos para continuar o crea una nueva cuenta para empezar.
            </p>
          </div>

          <!-- Login Form -->
          <form (ngSubmit)="handleLogin()" class="space-y-5">
            
            <!-- Campo: Correo Electrónico -->
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

            <!-- Campo: Contraseña -->
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
                  placeholder="••••••••"
                  class="w-full pl-10 pr-4 py-3 bg-white text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-polleria-gold transition rounded-xs"
                  required
                />
              </div>

              <div class="text-right pt-1">
                <a 
                  href="javascript:void(0)" 
                  (click)="handleForgotPassword()"
                  class="text-[11px] text-slate-400 hover:text-polleria-gold transition"
                >
                  ¿Olvidaste tu contraseña?
                </a>
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
                  <span>PROCESANDO...</span>
                } @else {
                  <span>INGRESAR</span>
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

            <!-- Botón Secundario Dorado: Enlace a Registro -->
            <a 
              routerLink="/registro"
              class="w-full py-4 bg-transparent border-2 border-polleria-gold hover:bg-polleria-gold/10 active:scale-[0.99] text-polleria-gold font-display text-xl tracking-wider uppercase transition duration-200 block text-center cursor-pointer rounded-xs"
            >
              CREAR CUENTA NUEVA
            </a>

          </form>

        </div>
      </div>

    </div>
  `
})
export class LoginComponent {
  readonly auth = inject(AuthService);
  private router = inject(Router);
  private notify = inject(NotificationService);

  correo = '';
  password = '';

  handleLogin(): void {
    if (!this.correo || !this.password) {
      this.notify.showError('Por favor ingresa tu correo y contraseña');
      return;
    }

    this.auth.login({
      correoOrCelular: this.correo,
      password: this.password
    }).subscribe({
      next: (res) => {
        this.notify.showSuccess(`¡Hola de nuevo, ${res.user.nombre}!`);
        if (res.user.rol === 'CHEF') {
          this.router.navigate(['/cocina']);
        } else if (res.user.rol === 'ADMIN') {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate(['/menu']);
        }
      },
      error: () => {
        this.notify.showError('Credenciales incorrectas');
      }
    });
  }

  handleForgotPassword(): void {
    this.notify.showInfo(
      'Recuperación de contraseña',
      'Ingresa tu correo para recibir un enlace seguro de restablecimiento.'
    );
  }
}
