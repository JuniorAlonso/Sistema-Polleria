import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { User, LoginRequest, RegisterRequest, AuthResponse, UserRole } from '../models/user.model';
import { environment } from '../../../environments/environment';
import { of, tap, delay } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  // State Signals (React state equivalent)
  readonly currentUser = signal<User | null>(null);
  readonly token = signal<string | null>(null);
  readonly isLoading = signal<boolean>(false);

  // Computed derivations
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly userRole = computed<UserRole | null>(() => this.currentUser()?.rol ?? null);
  readonly isAdmin = computed(() => this.currentUser()?.rol === 'ADMIN');
  readonly isChef = computed(() => this.currentUser()?.rol === 'CHEF');
  readonly isMozo = computed(() => this.currentUser()?.rol === 'MOZO');

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
   * RF02: Inicio de Sesión (soporta microservicio y fallback mock para desarrollo)
   */
  login(credentials: LoginRequest) {
    this.isLoading.set(true);

    // Mock initial user for rapid frontend dev & testing if microservice is offline
    const isMock = true; // cambiar o conectar a this.http.post<AuthResponse>(`${environment.services.auth}/login`, credentials)
    
    if (isMock) {
      // Determinar rol simulado según correo para pruebas
      let rol: UserRole = 'CLIENTE';
      if (credentials.correoOrCelular.includes('admin')) rol = 'ADMIN';
      else if (credentials.correoOrCelular.includes('cocina') || credentials.correoOrCelular.includes('chef')) rol = 'CHEF';
      else if (credentials.correoOrCelular.includes('mozo')) rol = 'MOZO';

      const mockResponse: AuthResponse = {
        token: 'mock-jwt-token-xyz123',
        user: {
          id: 'usr-1',
          nombre: credentials.correoOrCelular.split('@')[0] || 'Cliente Pollería',
          correo: credentials.correoOrCelular,
          celular: '999888777',
          rol: rol
        }
      };

      return of(mockResponse).pipe(
        delay(600),
        tap(res => {
          this.setSession(res);
          this.isLoading.set(false);
        })
      );
    }

    return this.http.post<AuthResponse>(`${environment.services.auth}/login`, credentials).pipe(
      tap({
        next: (res) => {
          this.setSession(res);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      })
    );
  }

  /**
   * RF01: Registro de Clientes
   */
  register(data: RegisterRequest) {
    this.isLoading.set(true);
    const mockResponse: AuthResponse = {
      token: 'mock-jwt-token-register',
      user: {
        id: 'usr-' + Date.now(),
        nombre: data.nombre,
        correo: data.correo,
        celular: data.celular,
        rol: 'CLIENTE'
      }
    };

    return of(mockResponse).pipe(
      delay(600),
      tap(res => {
        this.setSession(res);
        this.isLoading.set(false);
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
    }
  }

  private setSession(auth: AuthResponse): void {
    this.currentUser.set(auth.user);
    this.token.set(auth.token);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('polleria_user', JSON.stringify(auth.user));
      localStorage.setItem('polleria_token', auth.token);
    }
  }
}
