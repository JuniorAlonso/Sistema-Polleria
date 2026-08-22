import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest, TwoFactorRequest, UserSession } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly API = environment.authApiUrl;
  private readonly SESSION_KEY = 'polleria_session';

  // Signal con la sesión activa — reactivo en toda la app
  readonly session = signal<UserSession | null>(this.loadSession());
  readonly isAuthenticated = computed(() => !!this.session());
  readonly role = computed(() => this.session()?.role ?? null);
  readonly userName = computed(() => this.session()?.name ?? null);

  constructor(private http: HttpClient, private router: Router) {}

  register(data: RegisterRequest) {
    return this.http.post<AuthResponse>(`${this.API}/auth/register`, data).pipe(
      tap(res => { if (res.token) this.saveSession(res); })
    );
  }

  login(data: LoginRequest) {
    return this.http.post<AuthResponse>(`${this.API}/auth/login`, data).pipe(
      tap(res => { if (res.token) this.saveSession(res); })
    );
  }

  verifyTwoFactor(data: TwoFactorRequest) {
    return this.http.post<AuthResponse>(`${this.API}/auth/verify-2fa`, data).pipe(
      tap(res => { if (res.token) this.saveSession(res); })
    );
  }

  logout(): void {
    localStorage.removeItem(this.SESSION_KEY);
    this.session.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this.session()?.token ?? null;
  }

  hasRole(...roles: string[]): boolean {
    const r = this.role();
    return r ? roles.includes(r) : false;
  }

  redirectByRole(): void {
    const r = this.role();
    const routes: Record<string, string> = {
      ADMIN: '/admin',
      MOZO: '/mozo',
      COCINA: '/cocina',
      REPARTIDOR: '/mis-pedidos',
      CLIENTE: '/carta',
    };
    this.router.navigate([routes[r ?? ''] ?? '/carta']);
  }

  private saveSession(res: AuthResponse): void {
    const session: UserSession = {
      token: res.token!,
      name: res.name!,
      email: res.email,
      role: res.role,
    };
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    this.session.set(session);
  }

  private loadSession(): UserSession | null {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
}
