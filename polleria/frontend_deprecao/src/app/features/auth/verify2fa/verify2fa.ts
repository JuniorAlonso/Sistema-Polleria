import { Component, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-verify2fa',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './verify2fa.html',
  styles: [`
    .verify-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      padding: 16px;
    }
    mat-card {
      width: 100%;
      max-width: 380px;
    }
    mat-card-title {
      text-align: center;
    }
    mat-card-subtitle {
      text-align: center;
      margin-bottom: 16px;
    }
    mat-form-field {
      width: 100%;
    }
    .code-input {
      font-size: 1.5rem;
      letter-spacing: 8px;
      text-align: center;
    }
    .btn-verify {
      width: 100%;
      margin-top: 8px;
    }
    .error-msg {
      color: #f44336;
      font-size: 0.85rem;
      text-align: center;
      margin-top: 8px;
    }
  `],
})
export class Verify2faComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);

  loading = signal(false);
  errorMessage = signal('');
  email = signal('');

  form = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['email']) {
        this.email.set(params['email']);
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMessage.set('');

    const { code } = this.form.value;
    this.auth.verifyTwoFactor({ email: this.email(), code: code! }).subscribe({
      next: () => {
        this.loading.set(false);
        this.auth.redirectByRole();
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err?.error?.message ?? 'Código inválido o expirado.';
        this.errorMessage.set(msg);
        this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
      },
    });
  }
}
