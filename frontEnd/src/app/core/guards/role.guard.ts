import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { UserRole } from '../models/user.model';

const ROLE_HOME: Partial<Record<UserRole, string>> = {
  ADMIN: '/admin',
  CAJERO: '/cajero',
  CHEF: '/cocina',
  MOZO: '/mozo',
  REPARTIDOR: '/delivery'
};

/**
 * Authorizes a route for the given roles. ADMIN is always allowed so it can intervene in any flow.
 */
export const roleGuard = (allowedRoles: readonly UserRole[]): CanActivateFn => () => {
  const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) {
    return true; // SSR / prerender: authorization is enforced in the browser
  }

  const auth = inject(AuthService);
  const router = inject(Router);
  const notify = inject(NotificationService);

  const user = auth.currentUser();
  if (!auth.token() || !user) {
    notify.showInfo('Acceso Restringido', 'Debes iniciar sesión con tu cuenta de personal.');
    router.navigate(['/login']);
    return false;
  }

  if (user.rol === 'CLIENTE') {
    notify.showError('No tienes permisos de personal para acceder a esta área.');
    router.navigate(['/menu']);
    return false;
  }

  if (user.rol === 'ADMIN' || allowedRoles.includes(user.rol)) {
    return true;
  }

  notify.showError('No tienes permisos para acceder a este módulo.');
  router.navigate([ROLE_HOME[user.rol] ?? '/login']);
  return false;
};
