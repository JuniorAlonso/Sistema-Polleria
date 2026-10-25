import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

export const staffGuard: CanActivateFn = (route, state) => {
  const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) {
    return true; // En el servidor (SSR / Prerender), permitir renderizado
  }

  const auth = inject(AuthService);
  const router = inject(Router);
  const notify = inject(NotificationService);

  const user = auth.currentUser();
  const token = auth.token();

  if (!token || !user) {
    notify.showInfo('Acceso Restringido', 'Debes iniciar sesión con tu cuenta de personal.');
    router.navigate(['/login']);
    return false;
  }

  // Si es un cliente regular intentando entrar a /admin o /cocina
  if (user.rol === 'CLIENTE') {
    notify.showError('No tienes permisos de personal para acceder a esta área.');
    router.navigate(['/menu']);
    return false;
  }

  // Si es personal intentando entrar a /admin sin ser ADMIN
  if (user.rol === 'CHEF' && state.url.startsWith('/admin')) {
    router.navigate(['/cocina']);
    return false;
  }
  if (user.rol === 'MOZO' && state.url.startsWith('/admin')) {
    router.navigate(['/mozo']);
    return false;
  }
  if (user.rol === 'REPARTIDOR' && state.url.startsWith('/admin')) {
    router.navigate(['/delivery']);
    return false;
  }
  if (user.rol === 'CAJERO' && state.url.startsWith('/admin')) {
    router.navigate(['/cajero']);
    return false;
  }

  // Si intentan entrar a /cajero sin ser CAJERO o ADMIN
  if (state.url.startsWith('/cajero') && user.rol !== 'CAJERO' && user.rol !== 'ADMIN') {
    notify.showError('Solo el personal de caja o administración puede acceder al módulo de caja.');
    router.navigate(['/admin']);
    return false;
  }

  // Si es Admin, Mozo, Chef, Repartidor o Cajero en su ruta correspondiente
  return true;
};
