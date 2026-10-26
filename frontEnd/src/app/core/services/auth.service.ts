import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, map, of } from 'rxjs';
import { User, LoginRequest, RegisterRequest, AuthResponse, UserRole } from '../models/user.model';
import { BackendAuthResponse, BackendVerificarSancionResponse } from '../models/api-contracts.model';
import { AuthAdapter } from '../adapters/auth.adapter';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  private readonly API_URL = environment.authApiUrl || 'http://localhost:8081';

  // Reactive State Signals
  readonly currentUser = signal<User | null>(null);
  readonly token = signal<string | null>(null);
  readonly refreshToken = signal<string | null>(null);
  readonly isLoading = signal<boolean>(false);

  // Computed derivations
  readonly isAuthenticated = computed(() => !!this.token() && !!this.currentUser());
  readonly userRole = computed<UserRole | null>(() => this.currentUser()?.rol ?? null);
  readonly isAdmin = computed(() => this.currentUser()?.rol === 'ADMIN');
  readonly isChef = computed(() => this.currentUser()?.rol === 'CHEF');
  readonly isMozo = computed(() => this.currentUser()?.rol === 'MOZO');
  readonly isRepartidor = computed(() => this.currentUser()?.rol === 'REPARTIDOR');
  readonly isCajero = computed(() => this.currentUser()?.rol === 'CAJERO');
  readonly isStaff = computed(() => {
    const rol = this.currentUser()?.rol;
    return !!rol && rol !== 'CLIENTE';
  });

  constructor() {
    this.restoreSession();
  }

  getAccessToken(): string | null {
    return this.token();
  }

  getRefreshToken(): string | null {
    return this.refreshToken();
  }

  private isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      const payload = JSON.parse(atob(parts[1]));
      return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  }

  private restoreSession(): void {
    if (isPlatformBrowser(this.platformId)) {
      const savedUser = localStorage.getItem('polleria_user');
      const savedToken = localStorage.getItem('polleria_token');
      const savedRefreshToken = localStorage.getItem('polleria_refresh_token');

      if (savedUser && savedToken) {
        if (this.isTokenExpired(savedToken)) {
          if (savedRefreshToken) {
            this.refreshTokens(savedRefreshToken).subscribe({
              error: () => this.limpiarSesion()
            });
          } else {
            this.limpiarSesion();
          }
          return;
        }

        try {
          this.currentUser.set(JSON.parse(savedUser));
          this.token.set(savedToken);
          this.refreshToken.set(savedRefreshToken || null);
        } catch {
          this.limpiarSesion();
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
        // El backend responde { errors: { campo: mensaje } } en validaciones o { error: mensaje } en reglas de negocio
        const erroresCampo = err?.error?.errors ? Object.values(err.error.errors).join('. ') : null;
        const errMsg = erroresCampo || err?.error?.error || err?.error?.message
          || (err?.status === 0 ? 'No se pudo conectar con el servidor de autenticación' : 'Error al registrar usuario');
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
   * Renovación de tokens (Refresh Token Rotation - RTR)
   */
  refreshTokens(tokenToRefresh?: string): Observable<AuthResponse> {
    const currentRefresh = tokenToRefresh || this.refreshToken();
    if (!currentRefresh) {
      return throwError(() => new Error('No refresh token disponible'));
    }

    return this.http.post<BackendAuthResponse>(`${this.API_URL}/auth/refresh`, {
      refreshToken: currentRefresh
    }).pipe(
      map(dto => AuthAdapter.toAuthResponse(dto)),
      tap(authResp => {
        if (authResp.token) {
          this.setSession(authResp);
        }
      })
    );
  }

  /**
   * RF03: Cerrar Sesión con revocación en backend
   */
  logout(): void {
    const currentRefresh = this.refreshToken();
    if (currentRefresh) {
      // Intento de revocación en backend (fire and forget)
      this.http.post(`${this.API_URL}/auth/logout`, { refreshToken: currentRefresh })
        .subscribe({ error: () => {} });
    }
    this.forceLogout();
  }

  /**
   * Cierre forzado de sesión: limpia las credenciales **y saca al usuario de la página**.
   *
   * La navegación es imprescindible: los guards solo se evalúan al navegar, así que un componente
   * ya montado (por ejemplo `SalonService`, que carga mesas en su constructor y luego cada 6 s)
   * seguiría llamando a endpoints protegidos sin sesión y llenaría la consola de errores 403.
   */
  forceLogout(): void {
    this.limpiarSesion();
    this.volverAlLogin();
  }

  /** Limpia las credenciales sin navegar. */
  private limpiarSesion(): void {
    this.currentUser.set(null);
    this.token.set(null);
    this.refreshToken.set(null);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('polleria_user');
      localStorage.removeItem('polleria_token');
      localStorage.removeItem('polleria_refresh_token');
    }
  }

  /**
   * No navega al arrancar (`restoreSession`): descartar una sesión vieja en el constructor del
   * servicio no debe expulsar a un visitante anónimo de una página pública como la carta.
   */
  private volverAlLogin(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (this.router.url.startsWith('/login')) {
      return;
    }
    this.router.navigate(['/login']);
  }

  private setSession(auth: AuthResponse): void {
    this.currentUser.set(auth.user);
    this.token.set(auth.token);
    if (auth.refreshToken) {
      this.refreshToken.set(auth.refreshToken);
    }

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('polleria_user', JSON.stringify(auth.user));
      localStorage.setItem('polleria_token', auth.token);
      if (auth.refreshToken) {
        localStorage.setItem('polleria_refresh_token', auth.refreshToken);
      }
    }
  }

  /**
   * Consulta pública de verificación de sanciones para bloquear pagos en efectivo / ContraPago.
   */
  verificarSancion(telefono?: string, email?: string, ip?: string): Observable<BackendVerificarSancionResponse> {
    const params: string[] = [];
    if (telefono) params.push(`telefono=${encodeURIComponent(telefono)}`);
    if (email) params.push(`email=${encodeURIComponent(email)}`);
    if (ip) params.push(`ip=${encodeURIComponent(ip)}`);
    const query = params.length > 0 ? `?${params.join('&')}` : '';

    return this.http.get<BackendVerificarSancionResponse>(`${this.API_URL}/auth/sanciones/verificar${query}`).pipe(
      catchError(() => of({ sancionado: false, bloqueadoEfectivo: false, bloqueadoTotal: false }))
    );
  }
}
