import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Modo de render por ruta.
 *
 * Las rutas de personal (`admin`, `mozo`, `cocina`, `delivery`) se renderizan **solo en el
 * cliente**. Con el modo por defecto las renderizaba el servidor, y ahí los guards devuelven
 * `true` a propósito (no hay navegador ni `localStorage`), así que el servidor montaba esos
 * componentes y sus servicios sin sesión: `SalonService` pedía `/mesas` sin token, el backend
 * respondía `403` con cuerpo vacío y el error aparecía en la consola del render SSR en cada carga.
 * Además, el HTML prerenderizado entregaba la cáscara de páginas protegidas a cualquiera.
 *
 * Las rutas públicas siguen prerenderizadas: no hay motivo para perder velocidad ni SEO en ellas.
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'mozo', renderMode: RenderMode.Client },
  { path: 'cocina', renderMode: RenderMode.Client },
  { path: 'delivery', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Prerender },
];
