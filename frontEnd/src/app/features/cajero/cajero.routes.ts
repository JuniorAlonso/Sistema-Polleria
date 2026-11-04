import { Routes } from '@angular/router';

export const CAJERO_ROUTES: Routes = [
  {
    path: '',
    title: 'Punto de Cobro & Caja - San Pollo Cajero',
    loadComponent: () => import('./cajero-dashboard.component').then(m => m.CajeroDashboardComponent)
  }
];
