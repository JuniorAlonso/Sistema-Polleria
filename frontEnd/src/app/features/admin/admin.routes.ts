import { Routes } from '@angular/router';

/**
 * Panel de administración: el shell (`AdminDashboardComponent`) aloja sidebar + header y cada
 * pestaña es una ruta hija lazy con su propio contenedor. El admin conserva todas las acciones
 * del flujo de pedidos (puede intervenir), solo cambia dónde viven.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    title: 'Panel de Control y Comandas - San Pollo Admin',
    loadComponent: () => import('./dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'ordenes' },
      {
        path: 'ordenes',
        loadComponent: () => import('./pages/ordenes/admin-ordenes.page').then(m => m.AdminOrdenesPage)
      },
      {
        path: 'mesas',
        loadComponent: () => import('./pages/mesas/admin-mesas.page').then(m => m.AdminMesasPage)
      },
      {
        path: 'inventario',
        loadComponent: () => import('./pages/inventario/admin-inventario.page').then(m => m.AdminInventarioPage)
      },
      {
        path: 'reparto',
        loadComponent: () => import('./pages/reparto/admin-reparto.page').then(m => m.AdminRepartoPage)
      },
      {
        path: 'finanzas',
        loadComponent: () => import('./pages/finanzas/admin-finanzas.page').then(m => m.AdminFinanzasPage)
      },
      {
        path: 'feedback',
        loadComponent: () => import('./pages/feedback/admin-feedback.page').then(m => m.AdminFeedbackPage)
      },
      {
        path: 'notificaciones',
        loadComponent: () => import('./pages/notificaciones/admin-notificaciones.page').then(m => m.AdminNotificacionesPage)
      },
      {
        path: 'soporte',
        loadComponent: () => import('./pages/soporte/admin-soporte.page').then(m => m.AdminSoportePage)
      }
    ]
  }
];
