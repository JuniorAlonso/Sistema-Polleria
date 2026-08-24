import { Component, EventEmitter, Input, Output, signal, OnDestroy, OnInit, OnChanges, SimpleChanges, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-two-factor-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div 
      *ngIf="isOpen" 
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
    >
      <div 
        class="relative w-full max-w-md bg-slate-900 border-2 border-polleria-gold/40 shadow-2xl shadow-black rounded-2xl overflow-hidden animate-scale-up text-slate-100"
      >
        <!-- Top Crimson Accent Bar -->
        <div class="h-2 w-full bg-gradient-to-r from-polleria-crimson via-polleria-gold to-polleria-crimson"></div>

        <!-- Modal Header -->
        <div class="p-6 sm:p-8 text-center space-y-3 relative">
          <!-- Close Button -->
          <button 
            (click)="onCancel()"
            class="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition"
            title="Cerrar"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>

          <!-- Security Shield Icon -->
          <div class="w-16 h-16 mx-auto rounded-full bg-polleria-gold/10 border border-polleria-gold/30 flex items-center justify-center text-polleria-gold shadow-lg shadow-polleria-gold/10">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
          </div>

          <div>
            <h3 class="font-display text-2xl sm:text-3xl uppercase tracking-wider text-white">
              VERIFICACIÓN EN DOS PASOS
            </h3>
            <div class="w-12 h-1 bg-polleria-gold mx-auto mt-1.5 rounded-full"></div>
          </div>

          <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Hemos enviado un código de 6 dígitos al correo:
            <span class="font-semibold text-polleria-gold block mt-1 tracking-wide">{{ maskedEmail }}</span>
          </p>
        </div>

        <!-- Form Body -->
        <div class="px-6 sm:px-8 pb-8 space-y-6">
          
          <!-- OTP Input -->
          <div class="space-y-2">
            <label class="block text-center text-[11px] font-bold uppercase tracking-widest text-slate-400">
              INGRESA TU CÓDIGO DE 6 DÍGITOS
            </label>

            <div class="flex justify-center">
              <input 
                type="text" 
                [(ngModel)]="code"
                (ngModelChange)="onCodeInput($event)"
                maxlength="6"
                placeholder="••••••"
                autofocus
                class="w-56 text-center text-3xl sm:text-4xl tracking-[0.4em] font-mono font-black py-3 bg-slate-950 border-2 border-polleria-gold/60 focus:border-polleria-gold text-polleria-gold rounded-xl shadow-inner focus:outline-none focus:ring-4 focus:ring-polleria-gold/20 transition placeholder:text-slate-700"
              />
            </div>

            <!-- Error message if any -->
            <p *ngIf="errorMessage" class="text-xs text-rose-400 text-center font-medium animate-shake">
              {{ errorMessage }}
            </p>
          </div>

          <!-- Countdown / Expiry -->
          <div class="text-center text-xs text-slate-400">
            <span>Expira en: </span>
            <span class="font-mono font-bold text-slate-200">{{ formattedTime }}</span>
          </div>

          <!-- Actions -->
          <div class="space-y-3">
            <button 
              (click)="onVerify()" 
              [disabled]="code.length !== 6 || isVerifying"
              class="w-full py-4 bg-polleria-crimson hover:bg-polleria-crimsonHover active:scale-[0.99] text-white font-display text-lg tracking-wider uppercase transition duration-200 flex items-center justify-center gap-2 shadow-lg shadow-black/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer rounded-xl"
            >
              <span *ngIf="isVerifying" class="inline-block animate-spin mr-2">⟳</span>
              <span>{{ isVerifying ? 'VERIFICANDO...' : 'VERIFICAR Y ACCEDER' }}</span>
            </button>

            <div class="flex items-center justify-between text-xs pt-1">
              <button 
                type="button"
                (click)="onResendCode()"
                [disabled]="timeLeft > 240 || isResending"
                class="text-slate-400 hover:text-polleria-gold transition disabled:opacity-40 disabled:hover:text-slate-400 cursor-pointer"
              >
                {{ isResending ? 'Reenviando...' : '¿No recibiste el código? Reenviar' }}
              </button>

              <button 
                type="button"
                (click)="onCancel()"
                class="text-slate-500 hover:text-slate-300 transition"
              >
                Cancelar
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  `
})
export class TwoFactorModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isOpen = false;
  @Input() email = '';
  @Input() password = '';
  @Output() verified = new EventEmitter<{ user: any; token: string }>();
  @Output() closed = new EventEmitter<void>();

  private auth = inject(AuthService);
  private notify = inject(NotificationService);
  private platformId = inject(PLATFORM_ID);

  code = '';
  errorMessage = '';
  isVerifying = false;
  isResending = false;
  timeLeft = 300; // 5 minutos (300s)
  private timerInterval?: any;

  get maskedEmail(): string {
    if (!this.email) return '';
    const parts = this.email.split('@');
    if (parts.length !== 2) return this.email;
    const name = parts[0];
    const masked = name.length > 2 ? `${name.substring(0, 2)}***${name.slice(-1)}` : `${name}***`;
    return `${masked}@${parts[1]}`;
  }

  get formattedTime(): string {
    const mins = Math.floor(this.timeLeft / 60);
    const secs = this.timeLeft % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  ngOnInit(): void {
    if (this.isOpen && isPlatformBrowser(this.platformId)) {
      this.startTimer();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && changes['isOpen'].currentValue) {
      if (isPlatformBrowser(this.platformId)) {
        this.code = '';
        this.errorMessage = '';
        this.startTimer();
      }
    } else if (changes['isOpen'] && !changes['isOpen'].currentValue) {
      this.clearTimer();
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private startTimer(): void {
    this.clearTimer();
    this.timeLeft = 300;
    if (isPlatformBrowser(this.platformId)) {
      this.timerInterval = setInterval(() => {
        if (this.timeLeft > 0) {
          this.timeLeft--;
        } else {
          this.clearTimer();
          this.errorMessage = 'El código ha expirado. Por favor solicita uno nuevo.';
        }
      }, 1000);
    }
  }

  private clearTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  onCodeInput(val: string): void {
    this.code = val.replace(/\D/g, '').substring(0, 6);
    this.errorMessage = '';
    if (this.code.length === 6) {
      this.onVerify();
    }
  }

  onVerify(): void {
    if (this.code.length !== 6 || this.isVerifying) return;

    this.isVerifying = true;
    this.errorMessage = '';

    this.auth.verifyTwoFactor(this.email, this.code).subscribe({
      next: (res) => {
        this.isVerifying = false;
        this.clearTimer();
        this.verified.emit({ user: res.user, token: res.token });
      },
      error: (err) => {
        this.isVerifying = false;
        this.errorMessage = err.message || 'Código de verificación incorrecto o expirado';
      }
    });
  }

  onResendCode(): void {
    if (this.isResending) return;
    this.isResending = true;
    this.errorMessage = '';

    this.auth.login({ correoOrCelular: this.email, password: this.password }).subscribe({
      next: () => {
        this.isResending = false;
        this.startTimer();
        this.code = '';
        this.notify.showSuccess('Código reenviado con éxito a tu correo');
      },
      error: (err) => {
        this.isResending = false;
        this.errorMessage = err.message || 'Error al reenviar el código';
      }
    });
  }

  onCancel(): void {
    this.clearTimer();
    this.closed.emit();
  }
}
