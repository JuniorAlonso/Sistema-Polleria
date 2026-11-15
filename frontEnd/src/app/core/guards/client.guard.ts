import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ROLE_HOME } from './role.guard';

export const clientGuard: CanActivateFn = () => {
  const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) {
    return true; // En el servidor (SSR / Prerender), permitir renderizado
  }

  const auth = inject(AuthService);
  const router = inject(Router);

  const user = auth.currentUser();
  const token = auth.token();

  // Si no está autenticado o es CLIENTE, puede navegar normalmente por la tienda/carta
  if (!token || !user || user.rol === 'CLIENTE') {
    return true;
  }

  // Si es usuario de personal, redirigir directamente a su dashboard
  const destino = ROLE_HOME[user.rol];
  if (destino) {
    router.navigate([destino]);
    return false;
  }

  return true;
};
