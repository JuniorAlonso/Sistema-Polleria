import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ROLE_HOME } from './role.guard';

export const guestGuard: CanActivateFn = () => {
  const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) {
    return true; // En el servidor (SSR / Prerender), permitir renderizado
  }

  const auth = inject(AuthService);
  const router = inject(Router);

  const user = auth.currentUser();
  const token = auth.token();

  if (token && user) {
    router.navigate([ROLE_HOME[user.rol] ?? '/menu']);
    return false;
  }

  return true;
};
