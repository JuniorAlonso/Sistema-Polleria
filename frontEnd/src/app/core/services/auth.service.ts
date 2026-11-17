import { Injectable, signal, computed, inject, PLATFORM_ID, DestroyRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, map, finalize, shareReplay } from 'rxjs';
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
  private destroyRef = inject(DestroyRef);
  private readonly API_URL = environment.authApiUrl || 'http://localhost:8081';
  private refreshInFlight$: Observable<AuthResponse> | null = null;
  private sessionEpoch = 0;

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
    this.registerStorageSync();
  }

  getAccessToken(): string | null {
    return this.token();
  }

  getRefreshToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem('polleria_refresh_token');
      if (stored) {
        return stored;
      }
    }
    return this.refreshToken();
  }

  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      return JSON.parse(atob(padded)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  hasExpiredJwt(token: string | null = this.token()): boolean {
    if (!token) return false;
    const payload = this.decodeJwtPayload(token);
    return !!payload && typeof payload['exp'] === 'number' && payload['exp'] * 1000 <= Date.now();
  }

  private isTokenExpired(token: string): boolean {
    const payload = this.decodeJwtPayload(token);
    if (!payload) return true;
    return typeof payload['exp'] === 'number' && payload['exp'] * 1000 <= Date.now();
  }

  private restoreSession(): void {
    if (isPlatformBrowser(this.platformId)) {
      const savedUser = localStorage.getItem('polleria_user');
      const savedToken = localStorage.getItem('polleria_token');
      const savedRefreshToken = localStorage.getItem('polleria_refresh_token');

      if (savedUser && savedToken) {
        const expired = this.isTokenExpired(savedToken);
        if (expired && !savedRefreshToken) {
          this.limpiarSesion();
          return;
        }

        try {
          this.currentUser.set(JSON.parse(savedUser));
          this.token.set(savedToken);
          this.refreshToken.set(savedRefreshToken || null);
        } catch {
          this.limpiarSesion();
          return;
        }

        if (expired && savedRefreshToken) {
          this.refreshTokens(savedRefreshToken).subscribe({
            error: () => this.limpiarSesion()
          });
        }
      }
    }
  }

  private registerStorageSync(): void {
    if (!isPlatformBrowser(this.platformId) || typeof window === 'undefined') {
      return;
    }

    const onStorage = (event: StorageEvent) => {
      if (
        event.key !== null &&
        event.key !== 'polleria_token' &&
        event.key !== 'polleria_refresh_token' &&
        event.key !== 'polleria_user'
      ) {
        return;
      }

      const storedToken = localStorage.getItem('polleria_token');
      const storedRefresh = localStorage.getItem('polleria_refresh_token');
      const storedUser = localStorage.getItem('polleria_user');

      if (!storedToken || !storedUser) {
        this.currentUser.set(null);
        this.token.set(null);
        this.refreshToken.set(null);
        return;
      }

      try {
        this.currentUser.set(JSON.parse(storedUser));
        this.token.set(storedToken);
        this.refreshToken.set(storedRefresh);
      } catch {
        this.limpiarSesion();
      }
    };

    window.addEventListener('storage', onStorage);
    this.destroyRef.onDestroy(() => window.removeEventListener('storage', onStorage));
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
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    const currentRefresh = tokenToRefresh || this.getRefreshToken();
    if (!currentRefresh) {
      return throwError(() => new Error('No refresh token disponible'));
    }

    const epoch = this.sessionEpoch;
    this.refreshInFlight$ = this.http.post<BackendAuthResponse>(`${this.API_URL}/auth/refresh`, {
      refreshToken: currentRefresh
    }).pipe(
      map(dto => AuthAdapter.toAuthResponse(dto)),
      tap(authResp => {
        if (authResp.token && this.sessionEpoch === epoch) {
          this.setSession(authResp);
        }
      }),
      finalize(() => {
        this.refreshInFlight$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    return this.refreshInFlight$;
  }

  /**
   * RF03: Cerrar Sesión con revocación en backend
   */
  logout(): void {
    const currentRefresh = this.getRefreshToken();
    this.forceLogout();
    if (currentRefresh) {
      // Intento de revocación en backend (fire and forget)
      this.http.post(`${this.API_URL}/auth/logout`, { refreshToken: currentRefresh })
        .subscribe({ error: () => {} });
    }
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
    this.sessionEpoch++;
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
   * Si la consulta falla, el error se propaga (no se asume que el cliente está limpio).
   */
  verificarSancion(telefono?: string, email?: string, ip?: string): Observable<BackendVerificarSancionResponse> {
    const params: string[] = [];
    if (telefono) params.push(`telefono=${encodeURIComponent(telefono)}`);
    if (email) params.push(`email=${encodeURIComponent(email)}`);
    if (ip) params.push(`ip=${encodeURIComponent(ip)}`);
    const query = params.length > 0 ? `?${params.join('&')}` : '';

    // A failed check is not a clean record: the error reaches the caller, which must not assume
    // the customer is clear. The real enforcement stays server side when the order is created.
    return this.http.get<BackendVerificarSancionResponse>(`${this.API_URL}/auth/sanciones/verificar${query}`);
  }
}
