import { Routes } from '@angular/router';
import { MainLayoutComponent } from './shared/layouts/main-layout/main-layout.component';
import { roleGuard } from './core/guards/role.guard';
import { clientGuard } from './core/guards/client.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  // 1. Auth routes (Login & Registro protegidos contra usuarios ya autenticados)
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard],
    title: 'Acceso - Pollería San Pollo de Ica'
  },
  {
    path: 'registro',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent),
    canActivate: [guestGuard],
    title: 'Registro - Pollería San Pollo de Ica'
  },

  // 2. Checkout Split-Screen View (Solo clientes / invitados)
  {
    path: 'checkout',
    loadComponent: () => import('./features/client/checkout/checkout.component').then(m => m.CheckoutComponent),
    canActivate: [clientGuard],
    title: 'Finalizar Pedido y Pago - San Pollo de Ica'
  },
  {
    path: 'checkout/success',
    loadComponent: () => import('./features/client/checkout/checkout-status.component').then(m => m.CheckoutStatusComponent),
    title: 'Pago Aprobado - San Pollo de Ica'
  },
  {
    path: 'checkout/failure',
    loadComponent: () => import('./features/client/checkout/checkout-status.component').then(m => m.CheckoutStatusComponent),
    title: 'Pago No Completado - San Pollo de Ica'
  },
  {
    path: 'checkout/pending',
    loadComponent: () => import('./features/client/checkout/checkout-status.component').then(m => m.CheckoutStatusComponent),
    title: 'Pago en Proceso - San Pollo de Ica'
  },

  // 3. Staff areas: one lazy-loaded route tree per role (ADMIN may intervene in all of them)
  {
    path: 'admin',
    canActivate: [roleGuard(['ADMIN'])],
    loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES)
  },
  {
    path: 'cocina',
    canActivate: [roleGuard(['CHEF'])],
    loadChildren: () => import('./features/kitchen/kitchen.routes').then(m => m.KITCHEN_ROUTES)
  },
  {
    path: 'mozo',
    canActivate: [roleGuard(['MOZO'])],
    loadChildren: () => import('./features/mozo/mozo.routes').then(m => m.MOZO_ROUTES)
  },
  {
    path: 'delivery',
    canActivate: [roleGuard(['REPARTIDOR'])],
    loadChildren: () => import('./features/delivery/delivery.routes').then(m => m.DELIVERY_ROUTES)
  },
  {
    path: 'cajero',
    canActivate: [roleGuard(['CAJERO'])],
    loadChildren: () => import('./features/cajero/cajero.routes').then(m => m.CAJERO_ROUTES)
  },

  // 5. Main App routes (Clientes y navegación general)
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./features/client/home/home.component').then(m => m.HomeComponent),
        canActivate: [clientGuard],
        title: 'Pollería San Pollo de Ica - Sabor Criollo & Brasa'
      },
      {
        path: 'menu',
        loadComponent: () => import('./features/client/menu/menu.component').then(m => m.MenuComponent),
        canActivate: [clientGuard],
        title: 'Carta Digital - Pollería San Pollo de Ica'
      },
      {
        path: 'tracking',
        loadComponent: () => import('./features/client/order-tracking/order-tracking.component').then(m => m.OrderTrackingComponent),
        canActivate: [clientGuard],
        title: 'Seguimiento de Pedido en Vivo - San Pollo'
      }
    ]
  },

  // Fallback
  {
    path: '**',
    redirectTo: ''
  }
];
