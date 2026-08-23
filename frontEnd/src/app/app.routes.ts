import { Routes } from '@angular/router';
import { MainLayoutComponent } from './shared/layouts/main-layout/main-layout.component';

export const routes: Routes = [
  // 1. Auth routes (Pantallas completas independientes sin Header ni Footer)
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
    title: 'Acceso - Pollería San Pollo de Ica'
  },
  {
    path: 'registro',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent),
    title: 'Registro - Pollería San Pollo de Ica'
  },

  // 2. Checkout Split-Screen View (Pantalla completa Figma Imagen 1 y 2)
  {
    path: 'checkout',
    loadComponent: () => import('./features/client/checkout/checkout.component').then(m => m.CheckoutComponent),
    title: 'Finalizar Pedido y Pago - San Pollo de Ica'
  },

  // 3. Admin Backoffice (Acceso directo por URL /admin - Imagen 4)
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
    title: 'Panel de Control y Comandas - San Pollo Admin'
  },

  // 4. Main App routes (Envueltas con Navbar, Cart Drawer y Footer)
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./features/client/home/home.component').then(m => m.HomeComponent),
        title: 'Pollería San Pollo de Ica - Sabor Criollo & Brasa'
      },
      {
        path: 'menu',
        loadComponent: () => import('./features/client/menu/menu.component').then(m => m.MenuComponent),
        title: 'Carta Digital - Pollería San Pollo de Ica'
      },
      {
        path: 'tracking',
        loadComponent: () => import('./features/client/order-tracking/order-tracking.component').then(m => m.OrderTrackingComponent),
        title: 'Seguimiento de Pedido en Vivo - San Pollo'
      },
      {
        path: 'cocina',
        loadComponent: () => import('./features/kitchen/kitchen-kds.component').then(m => m.KitchenKdsComponent),
        title: 'KDS Cocina & Horno - San Pollo de Ica'
      }
    ]
  },

  // Fallback
  {
    path: '**',
    redirectTo: ''
  }
];
