import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { roleGuard } from './core/guards/role-guard';

export const routes: Routes = [
  { path: '', redirectTo: '/carta', pathMatch: 'full' },

  // Auth (públicas)
  { path: 'login',    loadComponent: () => import('./features/auth/login/login').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./features/auth/register/register').then(m => m.RegisterComponent) },
  { path: 'verify-2fa', loadComponent: () => import('./features/auth/verify2fa/verify2fa').then(m => m.Verify2faComponent) },

  // Carta pública (no requiere login)
  { path: 'carta', loadComponent: () => import('./features/carta/carta/carta').then(m => m.CartaComponent) },

  // Cliente
  {
    path: 'pedido',
    loadComponent: () => import('./features/pedidos/crear-pedido/crear-pedido').then(m => m.CrearPedidoComponent),
    canActivate: [authGuard],
  },
  {
    path: 'mis-pedidos',
    loadComponent: () => import('./features/pedidos/mis-pedidos/mis-pedidos').then(m => m.MisPedidosComponent),
    canActivate: [authGuard],
  },
  {
    path: 'pedido/:id',
    loadComponent: () => import('./features/pedidos/detalle-pedido/detalle-pedido').then(m => m.DetallePedidoComponent),
    canActivate: [authGuard],
  },

  // Cocina
  {
    path: 'cocina',
    loadComponent: () => import('./features/cocina/panel-cocina/panel-cocina').then(m => m.PanelCocinaComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['COCINA', 'ADMIN'] },
  },

  // Mozo
  {
    path: 'mozo',
    loadComponent: () => import('./features/mozo/panel-mozo/panel-mozo').then(m => m.PanelMozoComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['MOZO', 'ADMIN'] },
  },
  {
    path: 'mesas',
    loadComponent: () => import('./features/mozo/gestion-mesas/gestion-mesas').then(m => m.GestionMesasComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['MOZO', 'ADMIN'] },
  },

  // Admin
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/panel-admin/panel-admin').then(m => m.PanelAdminComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
  },
  {
    path: 'admin/productos',
    loadComponent: () => import('./features/admin/gestion-productos/gestion-productos').then(m => m.GestionProductosComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
  },

  // Fallback
  { path: '**', loadComponent: () => import('./shared/not-found/not-found').then(m => m.NotFoundComponent) },
];
