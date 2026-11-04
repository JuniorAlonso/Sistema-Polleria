import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const authTokenInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) {
    return next(req);
  }

  const authService = inject(AuthService);
  const token = authService.getAccessToken();

  let authReq = req;
  const isAuthEndpoint = req.url.includes('/auth/login') ||
                         req.url.includes('/auth/register') ||
                         req.url.includes('/auth/refresh');

  if (token && !isAuthEndpoint && !req.headers.has('Authorization')) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // ¿La petición salió identificada? Distingue "la sesión ya no existe" (sin cabecera) de un
  // rechazo legítimo de permisos con sesión válida (403 con el rol equivocado).
  const salioIdentificada = authReq.headers.has('Authorization');

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Sesión perdida: algún componente ya montado sigue llamando y el backend responde 401/403.
      // El 403 de una petición anónima llega con cuerpo vacío, así que aquí no hay nada que
      // reintentar: se cierra la sesión, se navega a /login y se corta el bucle de errores.
      if (!salioIdentificada && (error.status === 401 || error.status === 403) && !isAuthEndpoint) {
        authService.forceLogout();
        return throwError(() => error);
      }

      // Capturar 401 para renovación silenciosa mediante Refresh Token
      if (error.status === 401 && !isAuthEndpoint) {
        return handle401Error(authReq, next, authService);
      }
      return throwError(() => error);
    })
  );
};

function handle401Error(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService
): Observable<any> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    const currentRefreshToken = authService.getRefreshToken();
    if (!currentRefreshToken) {
      isRefreshing = false;
      authService.forceLogout();
      return throwError(() => new Error('Sesión expirada. No hay refresh token disponible.'));
    }

    return authService.refreshTokens(currentRefreshToken).pipe(
      switchMap((authResponse) => {
        isRefreshing = false;
        const newToken = authResponse.token;
        refreshTokenSubject.next(newToken);

        // Reintentar la petición que originalmente falló con el nuevo token
        return next(req.clone({
          setHeaders: {
            Authorization: `Bearer ${newToken}`
          }
        }));
      }),
      catchError((refreshErr) => {
        isRefreshing = false;
        refreshTokenSubject.next(null);
        // Si la renovación falla (expirado o reuso detectado), forzar salida del usuario
        authService.forceLogout();
        return throwError(() => refreshErr);
      })
    );
  } else {
    // Si ya hay un refresh en curso, las demás peticiones esperan en cola sin disparar más llamadas a /auth/refresh
    return refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(token => {
        return next(req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        }));
      })
    );
  }
}
