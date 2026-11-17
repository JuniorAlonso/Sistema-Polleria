import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { rutaDeRetornoSegura } from '../../../core/utils/return-url';
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
              <label for="register-nombre" class="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                NOMBRE COMPLETO
              </label>
              <div class="relative flex items-center">
                <span class="absolute left-3.5 text-slate-500">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                </span>
                <input 
                  id="register-nombre"
                  type="text" 
                  [(ngModel)]="nombre" 
                  #nombreCtrl="ngModel"
                  name="nombre"
                  maxlength="100"
                  autocomplete="name"
                  placeholder="Tu nombre y apellido"
                  class="w-full pl-10 pr-4 py-3 bg-white text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:ring-2 transition rounded-xs"
                  [ngClass]="mostrarErrorNombre(nombreCtrl.touched) ? 'ring-2 ring-rose-500 focus:ring-rose-500' : 'focus:ring-polleria-gold'"
                  required
                />
              </div>
              @if (mostrarErrorNombre(nombreCtrl.touched)) {
                <p class="text-[11px] text-rose-400">
                  Ingresa tu nombre completo (entre 2 y 100 caracteres).
                </p>
              }
            </div>

            <!-- Campo: Celular (RF01) -->
            <div class="space-y-1.5">
              <label for="register-celular" class="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                NÚMERO DE CELULAR (WHATSAPP)
              </label>
              <div class="relative flex items-center">
                <span class="absolute left-3.5 text-slate-500">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                  </svg>
                </span>
                <input 
                  id="register-celular"
                  type="tel" 
                  [(ngModel)]="celular" 
                  #celularCtrl="ngModel"
                  (input)="onCelularInput($event)"
                  name="celular"
                  inputmode="numeric"
                  maxlength="9"
                  pattern="^9[0-9]{8}$"
                  autocomplete="tel-national"
                  placeholder="Ej. 987654321"
                  class="w-full pl-10 pr-14 py-3 bg-white text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:ring-2 transition rounded-xs"
                  [ngClass]="mostrarErrorCelular(celularCtrl.touched) ? 'ring-2 ring-rose-500 focus:ring-rose-500' : 'focus:ring-polleria-gold'"
                  required
                />
                <span
                  class="absolute right-3 text-[11px] font-semibold tabular-nums"
                  [ngClass]="esCelularValido(celular) ? 'text-emerald-600' : 'text-slate-400'"
                >
                  {{ celular.length }}/9
                </span>
              </div>
              @if (mostrarErrorCelular(celularCtrl.touched)) {
                <p class="text-[11px] text-rose-400">
                  {{ mensajeErrorCelular() }}
                </p>
              } @else {
                <p class="text-[11px] text-slate-500">
                  Solo números: 9 dígitos empezando con 9.
                </p>
              }
            </div>

            <!-- Campo: Correo Electrónico (RF01) -->
            <div class="space-y-1.5">
              <label for="register-correo" class="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                CORREO ELECTRÓNICO
              </label>
              <div class="relative flex items-center">
                <span class="absolute left-3.5 text-slate-500">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                </span>
                <input 
                  id="register-correo"
                  type="email" 
                  [(ngModel)]="correo" 
                  #correoCtrl="ngModel"
                  name="correo"
                  maxlength="150"
                  autocomplete="email"
                  placeholder="tu@email.com"
                  class="w-full pl-10 pr-4 py-3 bg-white text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:ring-2 transition rounded-xs"
                  [ngClass]="mostrarErrorCorreo(correoCtrl.touched) ? 'ring-2 ring-rose-500 focus:ring-rose-500' : 'focus:ring-polleria-gold'"
                  required
                />
              </div>
              @if (mostrarErrorCorreo(correoCtrl.touched)) {
                <p class="text-[11px] text-rose-400">
                  Ingresa un correo electrónico válido (ej. tu&#64;email.com).
                </p>
              }
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
                  [type]="mostrarPassword ? 'text' : 'password'"
                  [(ngModel)]="password"
                  name="password"
                  placeholder="Mínimo 6 caracteres, letras y números"
                  autocomplete="new-password"
                  class="w-full pl-10 pr-11 py-3 bg-white text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-polleria-gold transition rounded-xs"
                  required
                />
                <button
                  type="button"
                  (click)="mostrarPassword = !mostrarPassword"
                  [attr.aria-label]="mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  [title]="mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  class="absolute right-3 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                >
                  @if (mostrarPassword) {
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                    </svg>
                  } @else {
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                  }
                </button>
              </div>

              <!-- Requisitos de la contraseña (mismas reglas que auth-service) -->
              <ul class="pt-1 space-y-1 text-[11px]">
                @for (regla of reglasPassword; track regla.texto) {
                  <li class="flex items-center gap-1.5" [ngClass]="regla.cumple(password) ? 'text-emerald-400' : 'text-slate-500'">
                    @if (regla.cumple(password)) {
                      <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                      </svg>
                    } @else {
                      <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="8" stroke-width="2"/>
                      </svg>
                    }
                    <span>{{ regla.texto }}</span>
                  </li>
                }
              </ul>
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
              queryParamsHandling="preserve"
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
  private route = inject(ActivatedRoute);
  private notify = inject(NotificationService);

  /** Where the new customer goes back after signing up (e.g. the checkout that asked them to). */
  readonly returnUrl = rutaDeRetornoSegura(this.route.snapshot.queryParamMap.get('returnUrl'));

  nombre = '';
  celular = '';
  correo = '';
  password = '';
  mostrarPassword = false;
  intentoEnvio = false;

  private readonly celularRegex = /^9\d{8}$/;
  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Deben coincidir con las validaciones de RegisterRequest en auth-service
  readonly reglasPassword = [
    { texto: 'Al menos 6 caracteres', cumple: (p: string) => p.length >= 6 },
    { texto: 'Al menos una letra (a-z o A-Z)', cumple: (p: string) => /[A-Za-z]/.test(p) },
    { texto: 'Al menos un número (0-9)', cumple: (p: string) => /\d/.test(p) }
  ];

  normalizarCelular(valor: string): string {
    const soloDigitos = (valor || '').replace(/\D/g, '').replace(/^51(?=9\d{8}$)/, '');
    return soloDigitos.slice(0, 9);
  }

  onCelularInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const limpio = this.normalizarCelular(input.value);
    this.celular = limpio;
    if (input.value !== limpio) {
      input.value = limpio;
    }
  }

  esNombreValido(valor: string): boolean {
    const limpio = (valor || '').trim();
    return limpio.length >= 2 && limpio.length <= 100;
  }

  esCelularValido(valor: string): boolean {
    return this.celularRegex.test(this.normalizarCelular(valor));
  }

  esCorreoValido(valor: string): boolean {
    return this.emailRegex.test((valor || '').trim());
  }

  mostrarErrorNombre(touched: boolean | null): boolean {
    return (!!touched || this.intentoEnvio) && !this.esNombreValido(this.nombre);
  }

  mostrarErrorCelular(touched: boolean | null): boolean {
    return (!!touched || this.intentoEnvio) && !this.esCelularValido(this.celular);
  }

  mostrarErrorCorreo(touched: boolean | null): boolean {
    return (!!touched || this.intentoEnvio) && !this.esCorreoValido(this.correo);
  }

  mensajeErrorCelular(): string {
    const limpio = this.normalizarCelular(this.celular);
    if (!limpio) {
      return 'El número de celular es obligatorio.';
    }
    if (!limpio.startsWith('9')) {
      return 'El celular debe empezar con el dígito 9.';
    }
    return 'El celular debe tener exactamente 9 dígitos.';
  }

  handleRegister(): void {
    this.intentoEnvio = true;

    const nombreLimpio = this.nombre.trim();
    const celularLimpio = this.normalizarCelular(this.celular);
    const correoLimpio = this.correo.trim();

    this.celular = celularLimpio;

    if (!nombreLimpio || !celularLimpio || !correoLimpio || !this.password) {
      this.notify.showError('Por favor completa todos los campos para tu registro');
      return;
    }

    if (!this.esNombreValido(nombreLimpio)) {
      this.notify.showError('Nombre inválido', 'Debe tener entre 2 y 100 caracteres.');
      return;
    }

    if (!this.esCelularValido(celularLimpio)) {
      this.notify.showError(
        'Número de celular inválido',
        'Debe tener 9 dígitos numéricos y empezar con 9 (ej. 987654321).'
      );
      return;
    }

    if (!this.esCorreoValido(correoLimpio)) {
      this.notify.showError(
        'Correo electrónico inválido',
        'Ingresa un correo con formato válido (ej. tu@email.com).'
      );
      return;
    }

    const faltantes = this.reglasPassword.filter(r => !r.cumple(this.password));
    if (faltantes.length > 0) {
      this.notify.showError(
        'La contraseña no cumple los requisitos',
        'Falta: ' + faltantes.map(r => r.texto.toLowerCase()).join(', ')
      );
      return;
    }

    this.auth.register({
      nombre: nombreLimpio,
      celular: celularLimpio,
      correo: correoLimpio,
      password: this.password
    }).subscribe({
      next: () => {
        this.notify.showSuccess(`¡Bienvenido/a, ${nombreLimpio}!`, 'Tu cuenta ha sido creada exitosamente.');
        if (this.returnUrl) {
          this.router.navigateByUrl(this.returnUrl);
        } else {
          this.router.navigate(['/menu']);
        }
      },
      error: (err) => {
        this.notify.showError(err.message || 'Error al crear la cuenta');
      }
    });
  }
}
