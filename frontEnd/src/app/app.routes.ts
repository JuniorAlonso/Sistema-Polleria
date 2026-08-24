import { Routes } from '@angular/router';
import { MainLayoutComponent } from './shared/layouts/main-layout/main-layout.component';
import { staffGuard } from './core/guards/staff.guard';
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

  // 3. Admin Backoffice (Solo ADMIN, MOZO, REPARTIDOR)
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
    canActivate: [staffGuard],
    title: 'Panel de Control y Comandas - San Pollo Admin'
  },

  // 4. KDS Cocina (Solo COCINA / CHEF y ADMIN)
  {
    path: 'cocina',
    loadComponent: () => import('./features/kitchen/kitchen-kds.component').then(m => m.KitchenKdsComponent),
    canActivate: [staffGuard],
    title: 'KDS Cocina & Horno - San Pollo de Ica'
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
