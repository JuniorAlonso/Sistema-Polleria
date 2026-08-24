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

  // Si es personal de Cocina intentando entrar a /admin
  if (user.rol === 'CHEF' && state.url.startsWith('/admin')) {
    router.navigate(['/cocina']);
    return false;
  }

  // Si es Admin, Mozo, Chef o Repartidor en su ruta correspondiente
  return true;
};
