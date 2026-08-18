import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './login.html',
  styles: [`
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      padding: 16px;
    }
    mat-card {
      width: 100%;
      max-width: 400px;
    }
    mat-card-title {
      text-align: center;
      font-size: 1.5rem;
      margin-bottom: 8px;
    }
    mat-form-field {
      width: 100%;
      margin-bottom: 8px;
    }
    .btn-login {
      width: 100%;
      margin-top: 8px;
    }
    .register-link {
      text-align: center;
      margin-top: 16px;
      font-size: 0.9rem;
    }
    .error-msg {
      color: #f44336;
      font-size: 0.85rem;
      text-align: center;
      margin-top: 8px;
    }
  `],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  loading = signal(false);
  errorMessage = signal('');
  hidePassword = signal(true);

  form = this.fb.group({
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMessage.set('');

    const { identifier, password } = this.form.value;
    this.auth.login({ identifier: identifier!, password: password! }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.requiresTwoFactor) {
          this.router.navigate(['/verify-2fa'], { queryParams: { email: res.email } });
        } else {
          this.auth.redirectByRole();
        }
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err?.error?.message ?? 'Credenciales incorrectas. Inténtalo de nuevo.';
        this.errorMessage.set(msg);
        this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
      },
    });
  }

  togglePassword(): void {
    this.hidePassword.update(v => !v);
  }
}
