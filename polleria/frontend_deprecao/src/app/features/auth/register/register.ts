import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth';
import { Role } from '../../../core/models/auth.models';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
  ],
  templateUrl: './register.html',
  styles: [`
    .register-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      padding: 16px;
    }
    mat-card {
      width: 100%;
      max-width: 440px;
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
    .btn-register {
      width: 100%;
      margin-top: 8px;
    }
    .login-link {
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
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  loading = signal(false);
  errorMessage = signal('');
  hidePassword = signal(true);

  roles: { value: Role; label: string }[] = [
    { value: 'CLIENTE', label: 'Cliente' },
    { value: 'MOZO', label: 'Mozo' },
    { value: 'COCINA', label: 'Cocina' },
    { value: 'REPARTIDOR', label: 'Repartidor' },
    { value: 'ADMIN', label: 'Administrador' },
  ];

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['CLIENTE' as Role, [Validators.required]],
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMessage.set('');

    const { name, email, phone, password, role } = this.form.value;
    this.auth.register({
      name: name!,
      email: email!,
      phone: phone || undefined,
      password: password!,
      role: role as Role,
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.snackBar.open('Registro exitoso. ¡Bienvenido!', 'OK', { duration: 3000 });
        this.router.navigate(['/carta']);
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err?.error?.message ?? 'Error al registrar. Inténtalo de nuevo.';
        this.errorMessage.set(msg);
        this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
      },
    });
  }

  togglePassword(): void {
    this.hidePassword.update(v => !v);
  }
}
