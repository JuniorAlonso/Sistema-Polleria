import { EnvironmentInjector, PLATFORM_ID, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { ROLE_HOME, roleGuard } from './role.guard';
import { guestGuard } from './guest.guard';
import { clientGuard } from './client.guard';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { User, UserRole } from '../models/user.model';

describe('Route Guards (FE-14: shared ROLE_HOME map)', () => {
  let injector: EnvironmentInjector;
  let tokenSig = signal<string | null>(null);
  let userSig = signal<User | null>(null);
  let router: jasmine.SpyObj<Router>;
  let notify: jasmine.SpyObj<NotificationService>;

  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  const userWithRole = (rol: UserRole): User => ({
    id: '1',
    nombre: 'Usuario Prueba',
    correo: 'test@sanpollo.pe',
    rol,
    celular: '999888777'
  });

  beforeEach(() => {
    tokenSig = signal<string | null>(null);
    userSig = signal<User | null>(null);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['showInfo', 'showError']);

    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: AuthService, useValue: { token: tokenSig, currentUser: userSig } },
        { provide: Router, useValue: router },
        { provide: NotificationService, useValue: notify }
      ]
    });
    injector = TestBed.inject(EnvironmentInjector);
  });

  it('expone rutas canonicas en ROLE_HOME', () => {
    expect(ROLE_HOME).toEqual({
      ADMIN: '/admin',
      CAJERO: '/cajero',
      CHEF: '/cocina',
      MOZO: '/mozo',
      REPARTIDOR: '/delivery'
    });
  });

  describe('roleGuard', () => {
    it('redirige a /login cuando no hay sesión', () => {
      const result = runInInjectionContext(injector, () => roleGuard(['CAJERO'])(route, state));
      expect(result).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('rechaza a CLIENTE y redirige a /menu', () => {
      tokenSig.set('jwt');
      userSig.set(userWithRole('CLIENTE'));

      const result = runInInjectionContext(injector, () => roleGuard(['CAJERO'])(route, state));
      expect(result).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/menu']);
    });

    it('permite acceso a ADMIN y al rol autorizado', () => {
      tokenSig.set('jwt');
      userSig.set(userWithRole('ADMIN'));
      expect(runInInjectionContext(injector, () => roleGuard(['CAJERO'])(route, state))).toBeTrue();

      userSig.set(userWithRole('CAJERO'));
      expect(runInInjectionContext(injector, () => roleGuard(['CAJERO'])(route, state))).toBeTrue();
    });

    it('redirige al módulo propio según ROLE_HOME cuando el rol de personal no corresponde', () => {
      tokenSig.set('jwt');
      userSig.set(userWithRole('MOZO'));

      const result = runInInjectionContext(injector, () => roleGuard(['CAJERO'])(route, state));
      expect(result).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/mozo']);
    });
  });

  describe('guestGuard', () => {
    it('permite el ingreso sin sesión y redirige usuarios autenticados por ROLE_HOME o /menu', () => {
      expect(runInInjectionContext(injector, () => guestGuard(route, state))).toBeTrue();

      tokenSig.set('jwt');
      userSig.set(userWithRole('CHEF'));
      expect(runInInjectionContext(injector, () => guestGuard(route, state))).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/cocina']);

      userSig.set(userWithRole('CLIENTE'));
      expect(runInInjectionContext(injector, () => guestGuard(route, state))).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/menu']);
    });
  });

  describe('clientGuard', () => {
    it('permite invitados y CLIENTE, pero redirige al personal a su panel', () => {
      expect(runInInjectionContext(injector, () => clientGuard(route, state))).toBeTrue();

      tokenSig.set('jwt');
      userSig.set(userWithRole('CLIENTE'));
      expect(runInInjectionContext(injector, () => clientGuard(route, state))).toBeTrue();

      userSig.set(userWithRole('REPARTIDOR'));
      expect(runInInjectionContext(injector, () => clientGuard(route, state))).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/delivery']);
    });
  });
});
