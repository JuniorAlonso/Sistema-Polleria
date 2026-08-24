import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError, map } from 'rxjs';
import { User, LoginRequest, RegisterRequest, AuthResponse, UserRole } from '../models/user.model';
import { BackendAuthResponse } from '../models/api-contracts.model';
import { AuthAdapter } from '../adapters/auth.adapter';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private readonly API_URL = environment.authApiUrl || 'http://localhost:8081';

  // Reactive State Signals
  readonly currentUser = signal<User | null>(null);
  readonly token = signal<string | null>(null);
  readonly isLoading = signal<boolean>(false);

  // Computed derivations
  readonly isAuthenticated = computed(() => !!this.token() && !!this.currentUser());
  readonly userRole = computed<UserRole | null>(() => this.currentUser()?.rol ?? null);
  readonly isAdmin = computed(() => this.currentUser()?.rol === 'ADMIN');
  readonly isChef = computed(() => this.currentUser()?.rol === 'CHEF');
  readonly isMozo = computed(() => this.currentUser()?.rol === 'MOZO');
  readonly isRepartidor = computed(() => this.currentUser()?.rol === 'REPARTIDOR');
  readonly isStaff = computed(() => {
    const rol = this.currentUser()?.rol;
    return !!rol && rol !== 'CLIENTE';
  });

  constructor() {
    this.restoreSession();
  }

  private restoreSession(): void {
    if (isPlatformBrowser(this.platformId)) {
      const savedUser = localStorage.getItem('polleria_user');
      const savedToken = localStorage.getItem('polleria_token');
      if (savedUser && savedToken) {
        try {
          this.currentUser.set(JSON.parse(savedUser));
          this.token.set(savedToken);
        } catch {
          this.logout();
        }
      }
    }
  }

  /**
   * RF02: Inicio de Sesión conectando a auth-service (:8081)
   */
  login(credentials: LoginRequest): Observable<AuthResponse> {
    this.isLoading.set(true);
    const backendReq = AuthAdapter.toBackendLogin(credentials);

    return this.http.post<BackendAuthResponse>(`${this.API_URL}/auth/login`, backendReq).pipe(
      map(dto => AuthAdapter.toAuthResponse(dto)),
      tap(authResp => {
        this.isLoading.set(false);
        if (authResp.token) {
          this.setSession(authResp);
        }
      }),
      catchError(err => {
        this.isLoading.set(false);
        const errMsg = err?.error?.message || err?.error || 'Credenciales inválidas o servicio no disponible';
        return throwError(() => new Error(typeof errMsg === 'string' ? errMsg : 'Error de autenticación'));
      })
    );
  }

  /**
   * RF01: Registro de Clientes conectando a auth-service (:8081)
   */
  register(data: RegisterRequest): Observable<AuthResponse> {
    this.isLoading.set(true);
    const backendReq = AuthAdapter.toBackendRegister(data);

    return this.http.post<BackendAuthResponse>(`${this.API_URL}/auth/register`, backendReq).pipe(
      map(dto => AuthAdapter.toAuthResponse(dto)),
      tap(authResp => {
        this.isLoading.set(false);
        if (authResp.token) {
          this.setSession(authResp);
        }
      }),
      catchError(err => {
        this.isLoading.set(false);
        const errMsg = err?.error?.message || err?.error || 'Error al registrar usuario';
        return throwError(() => new Error(typeof errMsg === 'string' ? errMsg : 'Error de registro'));
      })
    );
  }

  /**
   * RF05: Verificación 2FA
   */
  verifyTwoFactor(email: string, code: string): Observable<AuthResponse> {
    this.isLoading.set(true);
    return this.http.post<BackendAuthResponse>(`${this.API_URL}/auth/verify-2fa`, { email, code }).pipe(
      map(dto => AuthAdapter.toAuthResponse(dto)),
      tap(authResp => {
        this.isLoading.set(false);
        if (authResp.token) {
          this.setSession(authResp);
        }
      }),
      catchError(err => {
        this.isLoading.set(false);
        const errMsg = err?.error?.message || 'Código 2FA incorrecto o expirado';
        return throwError(() => new Error(errMsg));
      })
    );
  }

  /**
   * RF03: Cerrar Sesión
   */
  logout(): void {
    this.currentUser.set(null);
    this.token.set(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('polleria_user');
      localStorage.removeItem('polleria_token');
      localStorage.removeItem('polleria_my_order_ids');
    }
  }

  private setSession(auth: AuthResponse): void {
    this.currentUser.set(auth.user);
    this.token.set(auth.token);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('polleria_user', JSON.stringify(auth.user));
      localStorage.setItem('polleria_token', auth.token);
      localStorage.removeItem('polleria_my_order_ids');
    }
  }
}
